from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import requests
from app.config import settings


class AIService:
    """
    剧本拆解（大模型 + 兜底 mock）

    - 优先走 OpenAI 兼容 Chat Completions
    - 未配置上游时走 mock（保证本地可跑）
    """

    FIELD_SEPARATOR = "_::~FIELD::~_"
    RECORD_SEPARATOR = "_::~RECORD::~_"
    OUTPUT_START = "_::~OUTPUT_START::~_"
    OUTPUT_END = "_::~OUTPUT_END::~_"

    def __init__(self) -> None:
        self.base_url = (
            str(getattr(settings, "SHOWDEMO_LLM_BASE_URL", "") or "").strip()
            or str(getattr(settings, "LLM_API_URL", "") or "").strip()
            or os.getenv("SHOWDEMO_LLM_BASE_URL", "").strip()
            or os.getenv("LLM_API_URL", "").strip()
        )
        self.api_key = (
            str(getattr(settings, "SHOWDEMO_LLM_API_KEY", "") or "").strip()
            or str(getattr(settings, "LLM_API_KEY", "") or "").strip()
            or os.getenv("SHOWDEMO_LLM_API_KEY", "").strip()
            or os.getenv("LLM_API_KEY", "").strip()
        )
        self.model = (
            str(getattr(settings, "SHOWDEMO_LLM_MODEL", "") or "").strip()
            or str(getattr(settings, "LLM_MODEL", "") or "").strip()
            or os.getenv("SHOWDEMO_LLM_MODEL", "").strip()
            or os.getenv("LLM_MODEL", "").strip()
            or "gpt-4o-mini"
        )
        timeout_from_settings = getattr(settings, "SHOWDEMO_LLM_TIMEOUT_SEC", 120)
        self.timeout_sec = float(timeout_from_settings or os.getenv("SHOWDEMO_LLM_TIMEOUT_SEC", "120") or "120")

        # 默认用 showdemo 仓库里你给的提示词文件
        self.prompt_file = os.getenv(
            "SHOWDEMO_DECOMPOSE_PROMPT_FILE",
            str(
                Path(__file__).resolve().parents[1]
                / "routers"
                / "输入10000字的话140个分镜左右，上下浮动不得超过百分之5，输入1000字左.txt"
            ),
        )

    async def decompose_script(self, script: str) -> list[dict]:
        text = (script or "").strip()
        if not text:
            raise ValueError("script_empty")

        # 强制：必须走真实大模型
        if not self.base_url or not self.api_key:
            raise RuntimeError("未配置大模型参数，请设置 SHOWDEMO_LLM_BASE_URL / SHOWDEMO_LLM_API_KEY / SHOWDEMO_LLM_MODEL")

        content = self._call_chat_completion(user_prompt=self._build_user_prompt(text))
        scenes = self._parse_storyboard_output(content)
        if not scenes:
            preview = (content or "").replace("\n", " ")[:220]
            raise RuntimeError(f"大模型返回内容不符合分镜格式，请检查提示词或模型输出。返回片段: {preview}")
        return scenes

    def _build_user_prompt(self, input_text: str) -> str:
        prompt = ""
        try:
            prompt = Path(self.prompt_file).read_text(encoding="utf-8")
        except Exception:
            # 如果读取失败，用最小提示词兜底（但仍按分隔符约定输出）
            prompt = (
                f"请把下面文案拆解为分镜，使用{self.OUTPUT_START}开头，{self.OUTPUT_END}结尾，"
                f"用{self.RECORD_SEPARATOR}分隔每条分镜。\n\n{{{{输入文案}}}}\n"
            )
        return prompt.replace("{{输入文案}}", input_text)

    def _call_chat_completion(self, *, user_prompt: str) -> str:
        endpoint = self._build_chat_endpoint(self.base_url)
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "你是一个严谨的短剧分镜拆解助手。严格遵循输出格式要求。"},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
        }
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": self.api_key if self.api_key.lower().startswith("bearer ") else f"Bearer {self.api_key}",
        }
        resp = requests.post(endpoint, json=payload, headers=headers, timeout=self.timeout_sec)
        if resp.status_code >= 400:
            # 兼容一些供应商用原始 key：401/403/404 时再试一次
            if resp.status_code in (401, 403, 404) and not self.api_key.lower().startswith("bearer "):
                headers["Authorization"] = self.api_key
                resp = requests.post(endpoint, json=payload, headers=headers, timeout=self.timeout_sec)
        resp.raise_for_status()
        data = resp.json()
        try:
            return (data["choices"][0]["message"]["content"] or "").strip()
        except Exception:
            return str(data)

    def _build_chat_endpoint(self, base_url: str) -> str:
        value = (base_url or "").strip().rstrip("/")
        if value.endswith("/chat/completions"):
            return value
        # DeepSeek 官方域名默认走 /chat/completions
        if "api.deepseek.com" in value:
            return f"{value}/chat/completions"
        if value.endswith("/v1"):
            return f"{value}/chat/completions"
        return f"{value}/v1/chat/completions"

    def _parse_storyboard_output(self, raw: str) -> list[dict]:
        """
        解析输出：
        - 取 OUTPUT_START/OUTPUT_END 之间内容
        - 按 RECORD_SEPARATOR 拆记录
        - 尝试抽取 时间/地点/人物/动作/台词，构造 Scene 字段
        """
        text = (raw or "").strip()
        if not text:
            return []

        # 取 markers 之间内容（若缺失则直接用全文）
        content = text
        if self.OUTPUT_START in text and self.OUTPUT_END in text:
            content = text.split(self.OUTPUT_START, 1)[1].split(self.OUTPUT_END, 1)[0]
        content = content.strip()
        if not content:
            return []

        # 按记录分隔符拆分（兼容前后换行）
        parts = re.split(rf"\n\s*{re.escape(self.RECORD_SEPARATOR)}\s*\n", content)
        records = [p.strip() for p in parts if p and p.strip()]
        if not records:
            return []

        scenes: list[dict] = []
        for idx, record in enumerate(records, start=1):
            scene = self._record_to_scene(idx, record)
            scenes.append(scene)
        return scenes

    def _record_to_scene(self, scene_index: int, record: str) -> dict:
        # 如果上游真的按 FIELD_SEPARATOR 输出，可直接切字段
        if self.FIELD_SEPARATOR in record:
            fields = [f.strip() for f in record.split(self.FIELD_SEPARATOR) if f.strip()]
            record_text = "\n".join(fields).strip()
        else:
            record_text = record.strip()

        # 简单提取台词行：包含 “说：”
        dialogue_lines = []
        for line in record_text.splitlines():
            if "说：" in line:
                dialogue_lines.append(line.strip())
        dialogue = "\n".join(dialogue_lines).strip()

        # prompt：用时间/地点/动作拼一个“镜头感提示”
        time_v = self._extract_kv(record_text, "时间")
        location_v = self._extract_kv(record_text, "地点")
        action_v = self._extract_kv(record_text, "动作")
        people_v = self._extract_kv(record_text, "人物")
        prompt_core = "，".join([v for v in [time_v, location_v, people_v, action_v] if v]) or record_text[:120]
        prompt = f"电影感镜头，{prompt_core}"

        return {
            "scene_index": scene_index,
            "prompt": prompt,
            "characters": (people_v or "").replace("，", ",").replace("、", ",") if people_v else None,
            "scene_description": record_text,
            "dialogue": dialogue,
            "camera_angle": "中景",
            "emotion": "自然",
        }

    def _extract_kv(self, text: str, key: str) -> str:
        # 匹配：时间：xxx 或 时间:xxx，取到行尾
        m = re.search(rf"^{re.escape(key)}\s*[：:]\s*(.+)$", text, flags=re.MULTILINE)
        return m.group(1).strip() if m else ""

ai_service = AIService()
