from __future__ import annotations

import base64
import json
import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

import requests


ImageInput = Union[str, Path]


class GeekNowImageAPI:
    """
    GeekNow 生图接口封装（摘自插件逻辑，做成独立类）。

    主要接口：
    1) generate_openai_image(): 调用 /v1/images/generations（适用于 grok/doubao/gpt-image-2 等 OpenAI 兼容模型）
    2) generate_gemini_image(): 调用 /v1beta/models/{model}:generateContent（适用于 Gemini 图像模型）
    """

    def __init__(self, api_key: str, base_url: str = "https://api.geeknow.top", timeout: int = 120) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        if not self.api_key:
            raise ValueError("api_key 不能为空")

    def generate_openai_image(
        self,
        model: str,
        prompt: str,
        size: str = "2560x1440",
        image_inputs: Optional[Sequence[ImageInput]] = None,
        n: int = 1,
        response_format: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        调用方式：
            POST {base_url}/v1/images/generations

        参数说明：
            model: 模型名，例如 "grok-4-2-image" / "doubao-seedream-5-0-260128" / "gpt-image-2"
            prompt: 提示词
            size: 图像尺寸，常见如 "2560x1440"、"2048x2048"，也可按中转要求传比例字符串
            image_inputs: 可选参考图列表，支持两种输入：
                - URL 字符串（http/https 开头）
                - 本地文件路径（自动转 base64）
            n: 返回图片数量
            response_format: 可选，部分模型支持 "url" / "b64_json"

        返回：
            API 原始 JSON（通常包含 data 列表）
        """
        url = f"{self.base_url}/v1/images/generations"
        headers = self._auth_json_headers()

        payload: Dict[str, Any] = {
            "model": model,
            "prompt": prompt,
            "n": n,
            "size": size,
        }
        if response_format:
            payload["response_format"] = response_format

        if image_inputs:
            payload["image"] = self._build_openai_images(image_inputs)

        resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
        self._raise_for_status(resp, "generate_openai_image")
        return resp.json()

    def generate_gemini_image(
        self,
        model: str,
        prompt: str,
        aspect_ratio: str = "16:9",
        image_size: str = "1K",
        reference_images: Optional[Sequence[ImageInput]] = None,
    ) -> Dict[str, Any]:
        """
        调用方式：
            POST {base_url}/v1beta/models/{model}:generateContent

        参数说明：
            model: Gemini 模型名，例如 "gemini-2.5-flash-image-preview"
            prompt: 提示词
            aspect_ratio: 宽高比，如 "16:9" / "9:16" / "1:1"
            image_size: 图片尺寸档位，如 "1K" / "2K"
            reference_images: 可选参考图列表（本地文件或 URL）
                - 本地文件：转 inlineData(base64)
                - URL：按 text part 附加（便于部分网关识别）

        返回：
            API 原始 JSON（候选结果通常在 candidates[0].content.parts）
        """
        url = f"{self.base_url}/v1beta/models/{model}:generateContent"
        headers = self._auth_json_headers()

        parts: List[Dict[str, Any]] = [{"text": prompt}]
        for item in reference_images or []:
            parts.extend(self._to_gemini_parts(item))

        payload = {
            "contents": [{"role": "user", "parts": parts}],
            "generationConfig": {
                "responseModalities": ["IMAGE", "TEXT"],
                "temperature": 1.0,
                "topP": 0.95,
                "maxOutputTokens": 8192,
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": image_size,
                },
            },
        }

        resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
        self._raise_for_status(resp, "generate_gemini_image")
        return resp.json()

    @staticmethod
    def extract_image_result(api_response: Dict[str, Any]) -> Tuple[Optional[str], List[str]]:
        """
        从统一响应中提取结果。

        返回：
            (first_b64_or_none, url_list)
        """
        b64_value: Optional[str] = None
        urls: List[str] = []

        if isinstance(api_response, dict) and "data" in api_response:
            for item in api_response.get("data", []):
                if not b64_value and item.get("b64_json"):
                    b64_value = item["b64_json"]
                if item.get("url"):
                    urls.append(item["url"])

        if isinstance(api_response, dict) and "candidates" in api_response:
            for cand in api_response.get("candidates", []):
                for part in cand.get("content", {}).get("parts", []):
                    inline_data = part.get("inlineData", {})
                    if not b64_value and isinstance(inline_data.get("data"), str):
                        data = inline_data["data"]
                        if data.startswith(("http://", "https://")):
                            urls.append(data)
                        else:
                            b64_value = data

        return b64_value, urls

    def _build_openai_images(self, image_inputs: Sequence[ImageInput]) -> List[str]:
        out: List[str] = []
        for item in image_inputs:
            text = str(item)
            if text.startswith(("http://", "https://")):
                out.append(text)
                continue
            path = Path(text)
            if not path.exists():
                raise FileNotFoundError(f"参考图不存在: {path}")
            out.append(base64.b64encode(path.read_bytes()).decode("utf-8"))
        return out

    def _to_gemini_parts(self, item: ImageInput) -> List[Dict[str, Any]]:
        text = str(item)
        if text.startswith(("http://", "https://")):
            return [{"text": text}]
        path = Path(text)
        if not path.exists():
            raise FileNotFoundError(f"参考图不存在: {path}")
        mime = mimetypes.guess_type(path.name)[0] or "image/png"
        b64 = base64.b64encode(path.read_bytes()).decode("utf-8")
        return [{"inlineData": {"mimeType": mime, "data": b64}}]

    def _auth_json_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    @staticmethod
    def _raise_for_status(resp: requests.Response, api_name: str) -> None:
        if resp.status_code == 200:
            return
        text = resp.text
        try:
            text = json.dumps(resp.json(), ensure_ascii=False)
        except Exception:
            pass
        raise RuntimeError(f"{api_name} 调用失败: HTTP {resp.status_code}, 响应: {text}")

