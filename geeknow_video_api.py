from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import requests


FileItem = Tuple[str, str, bytes, str]


class GeekNowVideoAPI:
    """
    GeekNow 生视频接口封装（摘自插件主流程，做成独立类）。

    主要接口：
    1) create_video_task_json(): JSON 方式提交任务（常见于 wan2.6 / Vidu / Kling / Hailuo）
    2) create_video_task_multipart(): multipart 方式提交任务（常见于 sora/grok 等）
    3) get_video_task_status(): 查询任务状态
    4) poll_until_completed(): 轮询直到完成并返回视频 URL
    5) download_video(): 下载视频（含 content 备用下载）
    """

    def __init__(self, api_key: str, base_url: str = "https://api.geeknow.top", timeout: int = 900) -> None:
        self.api_key = api_key.strip()
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        if not self.api_key:
            raise ValueError("api_key 不能为空")

    def create_video_task_json(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        调用方式：
            POST {base_url}/v1/videos
            Content-Type: application/json

        参数说明：
            payload: 任务请求体，常见字段：
                - model: 模型名（必填）
                - prompt: 提示词（必填）
                - seconds: 时长（字符串或数字）
                - size: 分辨率，如 "1280x720"
                - metadata.output_config.aspect_ratio: 宽高比，如 "16:9"
                - metadata.output_config.audio_generation: "Enabled"/"Disabled"
                - input_reference / first_frame_image / last_frame_image: 参考图（按模型要求）

        返回：
            API 原始 JSON，通常包含任务 id
        """
        url = f"{self.base_url}/v1/videos"
        headers = self._auth_headers()
        headers["Content-Type"] = "application/json"
        resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
        self._raise_for_status(resp, "create_video_task_json")
        return resp.json()

    def create_video_task_multipart(self, data: Dict[str, Any], files: Optional[Sequence[FileItem]] = None) -> Dict[str, Any]:
        """
        调用方式：
            POST {base_url}/v1/videos
            Content-Type: multipart/form-data

        参数说明：
            data: 表单字段，常见有 model/prompt/size/seconds
            files: 可选文件列表，每项格式：
                (field_name, file_name, file_bytes, mime_type)
                例如 ("input_reference", "ref1.png", b"...", "image/png")

        返回：
            API 原始 JSON，通常包含任务 id
        """
        url = f"{self.base_url}/v1/videos"
        headers = self._auth_headers()

        req_files = []
        for field_name, file_name, file_bytes, mime_type in files or []:
            req_files.append((field_name, (file_name, file_bytes, mime_type)))

        resp = requests.post(
            url,
            headers=headers,
            data=data,
            files=req_files if req_files else None,
            timeout=self.timeout,
            proxies={"http": None, "https": None},
        )
        self._raise_for_status(resp, "create_video_task_multipart")
        return resp.json()

    def get_video_task_status(self, task_id: str) -> Dict[str, Any]:
        """
        调用方式：
            GET {base_url}/v1/videos/{task_id}

        参数说明：
            task_id: 提交任务后返回的 id

        返回：
            状态 JSON，常见字段：
                - status: pending/queued/processing/completed/failed
                - output.url 或 video_url
        """
        url = f"{self.base_url}/v1/videos/{task_id}"
        resp = requests.get(url, headers=self._auth_headers(), timeout=self.timeout)
        self._raise_for_status(resp, "get_video_task_status")
        return resp.json()

    def poll_until_completed(
        self,
        task_id: str,
        poll_interval: int = 10,
        max_attempts: int = 300,
    ) -> str:
        """
        调用方式：
            循环调用 get_video_task_status(task_id)

        参数说明：
            task_id: 任务 id
            poll_interval: 轮询间隔秒数
            max_attempts: 最大轮询次数

        返回：
            完成后的 video_url

        异常：
            - 任务失败
            - 超过最大轮询次数
        """
        for _ in range(max_attempts):
            time.sleep(poll_interval)
            data = self.get_video_task_status(task_id)
            status = str(data.get("status", "")).lower()

            if status == "completed":
                video_url = self._extract_video_url(data)
                if not video_url:
                    raise RuntimeError(f"任务完成但未返回视频 URL: {data}")
                return video_url

            if status == "failed":
                reason = data.get("error") or data.get("detail") or "任务失败，未返回错误信息"
                raise RuntimeError(f"视频任务失败: {reason}")

        raise TimeoutError(f"超过最大轮询次数({max_attempts})，任务仍未完成: {task_id}")

    def download_video(self, video_url: str, output_path: str, task_id: Optional[str] = None) -> str:
        """
        调用方式：
            1) 先直接下载 video_url
            2) 若失败且提供 task_id，则尝试备用接口 GET /v1/videos/{task_id}/content

        参数说明：
            video_url: 视频直链
            output_path: 本地保存路径
            task_id: 可选，备用下载需要

        返回：
            成功保存的文件路径
        """
        output = Path(output_path)
        output.parent.mkdir(parents=True, exist_ok=True)

        if self._stream_download(video_url, output):
            return str(output)

        if task_id:
            backup_url = f"{self.base_url}/v1/videos/{task_id}/content"
            if self._stream_download(backup_url, output, headers=self._auth_headers()):
                return str(output)

        raise RuntimeError(f"视频下载失败: {video_url}")

    @staticmethod
    def build_file_items(file_map: Dict[str, str]) -> List[FileItem]:
        """
        工具函数：把 {字段名: 文件路径} 转成 create_video_task_multipart 的 files 参数。

        参数说明：
            file_map: 例如 {"input_reference": "D:/a.png", "first_frame_image": "D:/b.png"}
        """
        out: List[FileItem] = []
        for field, path in file_map.items():
            p = Path(path)
            if not p.exists():
                raise FileNotFoundError(f"文件不存在: {p}")
            mime = "image/png"
            suffix = p.suffix.lower()
            if suffix in {".jpg", ".jpeg"}:
                mime = "image/jpeg"
            elif suffix == ".webp":
                mime = "image/webp"
            out.append((field, p.name, p.read_bytes(), mime))
        return out

    def _stream_download(self, url: str, output: Path, headers: Optional[Dict[str, str]] = None) -> bool:
        req_headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Referer": "https://www.geeknow.top/",
        }
        if headers:
            req_headers.update(headers)
        try:
            with requests.get(url, headers=req_headers, stream=True, timeout=9000) as resp:
                if resp.status_code != 200:
                    return False
                with output.open("wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
            return True
        except Exception:
            return False

    @staticmethod
    def _extract_video_url(data: Dict[str, Any]) -> Optional[str]:
        output = data.get("output")
        if isinstance(output, dict) and output.get("url"):
            return output["url"]
        return data.get("video_url") or data.get("url") or (data.get("detail") or {}).get("url")

    def _auth_headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.api_key}"}

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

