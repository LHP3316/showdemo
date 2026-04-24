from __future__ import annotations

import asyncio
import json
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import settings


class GeeknowService:
    def __init__(self) -> None:
        self.base_url = (settings.GEEKNOW_API_URL or "https://api.geeknow.top").rstrip("/")
        self.api_key = (settings.GEEKNOW_API_KEY or "").strip()

    async def text_to_image(self, prompt: str, config: dict | None = None) -> str:
        if not self.api_key:
            return "https://via.placeholder.com/1024x576?text=Scene+Image"
        cfg = config or {}
        payload = {
            "model": cfg.get("model", "grok-4-2-image"),
            "prompt": prompt,
            "n": int(cfg.get("n", 1)),
            "size": cfg.get("size", "1280x720"),
        }
        result = await self._post_json("/v1/images/generations", payload)
        return self._extract_image(result)

    async def image_to_video(self, image_url: str, prompt: str | None = None, config: dict | None = None) -> str:
        if not self.api_key:
            return "https://via.placeholder.com/1024x576?text=Scene+Video"
        cfg = config or {}
        payload = {
            "model": cfg.get("model", "wan2.6-i2v"),
            "prompt": prompt or "cinematic movement",
            "seconds": str(cfg.get("seconds", 5)),
            "size": cfg.get("size", "1280x720"),
            "input_reference": [image_url],
            "metadata": {"output_config": {"aspect_ratio": cfg.get("aspect_ratio", "16:9"), "audio_generation": "Disabled"}},
        }
        create = await self._post_json("/v1/videos", payload)
        task_id = create.get("id") or create.get("task_id")
        if not task_id:
            raise RuntimeError(f"创建视频任务失败: {create}")
        for _ in range(int(cfg.get("max_attempts", 90))):
            await asyncio.sleep(int(cfg.get("poll_interval", 4)))
            status = await self._get_json(f"/v1/videos/{task_id}")
            st = str(status.get("status", "")).lower()
            if st == "completed":
                return self._extract_video(status) or ""
            if st == "failed":
                raise RuntimeError(f"视频任务失败: {status}")
        raise TimeoutError("视频任务轮询超时")

    async def image_to_image(self, image_url: str, prompt: str | None = None, config: dict | None = None) -> str:
        return await self.text_to_image(prompt or "enhance details", config=config)

    async def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._request_json, "POST", path, payload)

    async def _get_json(self, path: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._request_json, "GET", path, None)

    def _request_json(self, method: str, path: str, payload: dict[str, Any] | None) -> dict[str, Any]:
        body = None if payload is None else json.dumps(payload).encode("utf-8")
        req = Request(url=f"{self.base_url}{path}", method=method, data=body)
        req.add_header("Authorization", f"Bearer {self.api_key}")
        req.add_header("Content-Type", "application/json")
        try:
            with urlopen(req, timeout=180) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except HTTPError as exc:
            msg = exc.read().decode("utf-8", errors="ignore")
            raise RuntimeError(f"GeekNow HTTP {exc.code}: {msg}") from exc
        except URLError as exc:
            raise RuntimeError(f"GeekNow 网络异常: {exc}") from exc

    @staticmethod
    def _extract_image(result: dict[str, Any]) -> str:
        data = result.get("data")
        if isinstance(data, list) and data and isinstance(data[0], dict):
            if data[0].get("url"):
                return data[0]["url"]
        return "https://via.placeholder.com/1024x576?text=Scene+Image"

    @staticmethod
    def _extract_video(result: dict[str, Any]) -> str | None:
        output = result.get("output")
        if isinstance(output, dict) and output.get("url"):
            return output["url"]
        return result.get("video_url") or result.get("url")


geeknow_service = GeeknowService()
