from __future__ import annotations

import asyncio
import base64
import mimetypes
from pathlib import Path
from typing import Any
from uuid import uuid4

import requests
import cv2
from requests import exceptions as req_exc

from app.config import settings


class GeeknowService:
    def __init__(self) -> None:
        self.base_url = (settings.GEEKNOW_API_URL or "https://api.geeknow.top").rstrip("/")
        self.api_key = (settings.GEEKNOW_API_KEY or "").strip()
        self.project_root = Path(__file__).resolve().parents[3]
        self.uploads_root = self.project_root / "uploads"
        self.uploads_root.mkdir(parents=True, exist_ok=True)
        # requests 会默认读取系统环境变量代理（HTTP(S)_PROXY 等），
        # 在一些 Windows/企业网络环境会导致 SSL WRONG_VERSION_NUMBER。
        self.session = requests.Session()
        self.session.trust_env = False

    async def text_to_image(self, prompt: str, config: dict | None = None) -> str:
        images = await self.text_to_images(prompt, config=config)
        if not images:
            raise RuntimeError("生图接口未返回可用图片")
        return images[0]

    async def text_to_images(self, prompt: str, config: dict | None = None) -> list[str]:
        self._ensure_api_key()
        cfg = config or {}
        payload = {
            "model": cfg.get("model", "grok-4-2-image"),
            "prompt": prompt,
            "n": int(cfg.get("n", 1)),
            "size": cfg.get("size", "1280x720"),
        }
        if cfg.get("response_format"):
            payload["response_format"] = cfg["response_format"]
        result = await self._post_json("/v1/images/generations", payload)
        urls = self._extract_image_urls(result)
        if urls:
            return await asyncio.to_thread(self._download_images_to_local, urls, payload["n"])
        b64_images = self._extract_image_b64_list(result)
        if b64_images:
            return await asyncio.to_thread(self._save_b64_images_to_local, b64_images, payload["n"])
        raise RuntimeError(f"生图接口返回中未找到图片结果: {result}")

    async def image_to_video(self, image_url: str, prompt: str | None = None, config: dict | None = None) -> str:
        self._ensure_api_key()
        cfg = config or {}
        video_size = self._normalize_video_size(cfg.get("size", "1280x720"))
        resolved_image_ref = self._resolve_input_reference(image_url)
        if not resolved_image_ref:
            raise RuntimeError("图生视频缺少有效输入图，请先为当前镜头生成图片")
        payload = {
            "model": cfg.get("model", "wan2.6-i2v"),
            "prompt": prompt or "cinematic movement",
            "seconds": str(cfg.get("seconds", 5)),
            "size": video_size,
            # 新网关对 wan2.6-i2v 要求 input.img_url
            "input": {
                "img_url": resolved_image_ref,
            },
            # 兼容旧通道：保留历史字段
            "input_reference": [resolved_image_ref],
            "metadata": {
                "output_config": {
                    "aspect_ratio": cfg.get("aspect_ratio", "16:9"),
                    "audio_generation": cfg.get("audio_generation", "Disabled"),
                }
            },
        }
        create = await self._post_json("/v1/videos", payload)
        task_id = self._extract_task_id(create)
        if not task_id:
            raise RuntimeError(f"创建视频任务失败，缺少任务ID: {create}")

        poll_interval = int(cfg.get("poll_interval", 6))
        max_attempts = int(cfg.get("max_attempts", 120))
        for _ in range(max_attempts):
            await asyncio.sleep(poll_interval)
            status = await self._get_json(f"/v1/videos/{task_id}")
            state = str(status.get("status", "")).lower()
            if state == "completed":
                video_url = self._extract_video_url(status)
                if not video_url:
                    raise RuntimeError(f"视频任务完成但未返回URL: {status}")
                local_video = await asyncio.to_thread(self._download_video_to_local, video_url)
                # 自动抽取首帧作为封面（写入 uploads/images）
                await asyncio.to_thread(self._extract_first_frame_cover, local_video)
                return local_video
            if state == "failed":
                raise RuntimeError(f"视频任务失败: {status}")
        raise TimeoutError(f"视频任务轮询超时(task_id={task_id})")

    async def text_to_video(self, prompt: str, config: dict | None = None) -> str:
        """
        文生视频：
        - 不依赖输入图
        - 与 image_to_video 共用轮询与下载逻辑
        """
        self._ensure_api_key()
        cfg = config or {}
        clean_prompt = str(prompt or "").strip()
        if not clean_prompt:
            raise RuntimeError("文生视频缺少提示词，请填写视频提示词或场景描述")
        resolution = self._normalize_text_video_size(cfg.get("size", "1280x720"))
        payload = {
            "model": cfg.get("model", "wan2.6-t2v"),
            "prompt": clean_prompt,
            "seconds": str(cfg.get("seconds", 5)),
            "metadata": {
                "output_config": {
                    "resolution": resolution,
                    "aspect_ratio": cfg.get("aspect_ratio", "16:9"),
                    "audio_generation": cfg.get("audio_generation", "Disabled"),
                }
            },
        }
        create = await self._post_json("/v1/videos", payload)
        task_id = self._extract_task_id(create)
        if not task_id:
            raise RuntimeError(f"创建视频任务失败，缺少任务ID: {create}")

        poll_interval = int(cfg.get("poll_interval", 6))
        max_attempts = int(cfg.get("max_attempts", 120))
        for _ in range(max_attempts):
            await asyncio.sleep(poll_interval)
            status = await self._get_json(f"/v1/videos/{task_id}")
            state = str(status.get("status", "")).lower()
            if state == "completed":
                video_url = self._extract_video_url(status)
                if not video_url:
                    raise RuntimeError(f"视频任务完成但未返回URL: {status}")
                local_video = await asyncio.to_thread(self._download_video_to_local, video_url)
                await asyncio.to_thread(self._extract_first_frame_cover, local_video)
                return local_video
            if state == "failed":
                raise RuntimeError(f"视频任务失败: {status}")
        raise TimeoutError(f"视频任务轮询超时(task_id={task_id})")

    async def image_to_image(self, image_url: str, prompt: str | None = None, config: dict | None = None) -> str:
        return await self.text_to_image(prompt or "enhance details", config=config)

    async def _post_json(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        return await asyncio.to_thread(self._request_json, "POST", path, payload)

    async def _get_json(self, path: str) -> dict[str, Any]:
        return await asyncio.to_thread(self._request_json, "GET", path, None)

    def _request_json(self, method: str, path: str, payload: dict[str, Any] | None) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        url = f"{self.base_url}{path}"
        last_exc: Exception | None = None
        for attempt in range(3):
            try:
                resp = self.session.request(
                    method=method,
                    url=url,
                    headers=headers,
                    json=payload,
                    timeout=(30, 240),
                )
                break
            except (req_exc.SSLError, req_exc.ConnectionError) as exc:
                last_exc = exc
                # GeekNow 偶发 EOF/握手中断：重建 session 再试
                try:
                    self.session.close()
                except Exception:
                    pass
                self.session = requests.Session()
                self.session.trust_env = False
        else:
            raise RuntimeError(f"GeekNow 请求失败: {last_exc}") from last_exc

        if resp.status_code != 200:
            raise RuntimeError(f"GeekNow HTTP {resp.status_code}: {resp.text}")
        data = resp.json() if resp.text else {}
        if not isinstance(data, dict):
            raise RuntimeError(f"GeekNow 返回异常: {data}")
        return data

    def _ensure_api_key(self) -> None:
        if not self.api_key:
            raise RuntimeError("未配置 GEEKNOW_API_KEY，无法调用生图/生视频接口")

    @staticmethod
    def _extract_image_urls(result: dict[str, Any]) -> list[str]:
        out: list[str] = []
        data = result.get("data")
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("url"):
                    out.append(str(item["url"]))
        return out

    @staticmethod
    def _extract_image_b64_list(result: dict[str, Any]) -> list[str]:
        out: list[str] = []
        data = result.get("data")
        if isinstance(data, list):
            for item in data:
                if isinstance(item, dict) and item.get("b64_json"):
                    out.append(str(item["b64_json"]))

        candidates = result.get("candidates")
        if isinstance(candidates, list):
            for cand in candidates:
                parts = (cand or {}).get("content", {}).get("parts", [])
                for part in parts:
                    inline_data = (part or {}).get("inlineData", {})
                    encoded = inline_data.get("data")
                    if isinstance(encoded, str) and not encoded.startswith(("http://", "https://")):
                        out.append(encoded)
        return out

    @staticmethod
    def _extract_task_id(result: dict[str, Any]) -> str | None:
        for key in ("id", "task_id"):
            val = result.get(key)
            if val:
                return str(val)
        data = result.get("data")
        if isinstance(data, dict):
            for key in ("id", "task_id"):
                val = data.get(key)
                if val:
                    return str(val)
        return None

    @staticmethod
    def _extract_video_url(result: dict[str, Any]) -> str | None:
        output = result.get("output")
        if isinstance(output, dict) and output.get("url"):
            return str(output["url"])
        detail = result.get("detail")
        if isinstance(detail, dict) and detail.get("url"):
            return str(detail["url"])
        for key in ("video_url", "url"):
            val = result.get(key)
            if val:
                return str(val)
        return None

    def _download_images_to_local(self, urls: list[str], expected_n: int = 1) -> list[str]:
        out: list[str] = []
        target_dir = self.uploads_root / "images"
        target_dir.mkdir(parents=True, exist_ok=True)
        for url in urls:
            suffix = self._guess_suffix_from_url(url, "png")
            filename = f"{uuid4().hex}.{suffix}"
            save_path = target_dir / filename
            self._download_file(url, save_path)
            out.append(f"/uploads/images/{filename}")
        return self._split_grid_collage_if_needed(out, expected_n=expected_n)

    def _save_b64_images_to_local(self, b64_images: list[str], expected_n: int = 1) -> list[str]:
        out: list[str] = []
        target_dir = self.uploads_root / "images"
        target_dir.mkdir(parents=True, exist_ok=True)
        for b64_data in b64_images:
            filename = f"{uuid4().hex}.png"
            save_path = target_dir / filename
            save_path.write_bytes(base64.b64decode(b64_data))
            out.append(f"/uploads/images/{filename}")
        return self._split_grid_collage_if_needed(out, expected_n=expected_n)

    def _download_video_to_local(self, video_url: str) -> str:
        target_dir = self.uploads_root / "videos"
        target_dir.mkdir(parents=True, exist_ok=True)
        suffix = self._guess_suffix_from_url(video_url, "mp4")
        filename = f"{uuid4().hex}.{suffix}"
        save_path = target_dir / filename
        self._download_file(video_url, save_path)
        return f"/uploads/videos/{filename}"

    def _extract_first_frame_cover(self, local_video_url: str) -> str | None:
        """
        从本地 /uploads/videos/*.mp4 抽取第一帧，写入 /uploads/images/*.jpg
        返回封面图片的本地 URL（/uploads/images/...）
        """
        text = str(local_video_url or "").strip()
        if not text.startswith("/uploads/videos/"):
            return None
        video_path = self.project_root / text.lstrip("/")
        if not video_path.exists():
            return None

        cap = cv2.VideoCapture(str(video_path))
        try:
            ok, frame = cap.read()
        finally:
            cap.release()
        if not ok or frame is None:
            return None

        target_dir = self.uploads_root / "images"
        target_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid4().hex}.jpg"
        out_path = target_dir / filename
        # OpenCV 写 jpg
        cv2.imwrite(str(out_path), frame)
        return f"/uploads/images/{filename}"

    def _resolve_input_reference(self, image_url: str) -> str:
        text = str(image_url or "").strip()
        if text.startswith(("http://", "https://", "data:")):
            return text
        if text.startswith("/uploads/"):
            local_path = self.project_root / text.lstrip("/")
            if local_path.exists():
                mime = mimetypes.guess_type(local_path.name)[0] or "image/png"
                encoded = base64.b64encode(local_path.read_bytes()).decode("utf-8")
                return f"data:{mime};base64,{encoded}"
            return ""
        return text

    @staticmethod
    def _normalize_video_size(raw_size: Any) -> str:
        """
        wan2.6-i2v 仅支持 720P/1080P。
        兼容旧配置中的 1280x720/1920x1080/720p/1080p 等写法。
        """
        text = str(raw_size or "").strip().upper()
        mapping = {
            "1280X720": "720P",
            "1920X1080": "1080P",
            "720P": "720P",
            "1080P": "1080P",
        }
        if text in mapping:
            return mapping[text]
        # 容忍 "720" / "1080" 这类简写
        if text == "720":
            return "720P"
        if text == "1080":
            return "1080P"
        return "720P"

    @staticmethod
    def _normalize_text_video_size(raw_size: Any) -> str:
        """
        文生视频通道常要求尺寸格式为 1280*720 / 1920*1080。
        兼容前端与历史配置中的 720P/1080P/1280x720/1920x1080。
        """
        text = str(raw_size or "").strip().upper()
        mapping = {
            "720P": "1280*720",
            "1080P": "1920*1080",
            "1280X720": "1280*720",
            "1920X1080": "1920*1080",
            "1280*720": "1280*720",
            "1920*1080": "1920*1080",
            "720": "1280*720",
            "1080": "1920*1080",
        }
        return mapping.get(text, "1280*720")

    @staticmethod
    def _guess_suffix_from_url(url: str, default_suffix: str) -> str:
        clean = str(url or "").split("?", 1)[0].split("#", 1)[0]
        suffix = Path(clean).suffix.lower().lstrip(".")
        if suffix in {"png", "jpg", "jpeg", "webp", "gif", "mp4", "mov", "webm"}:
            return suffix
        return default_suffix

    def _download_file(self, url: str, save_path: Path) -> None:
        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Referer": "https://www.geeknow.top/",
        }
        last_exc: Exception | None = None
        for _ in range(3):
            try:
                resp = self.session.get(
                    url,
                    headers=headers,
                    stream=True,
                    timeout=(30, 900),
                )
                break
            except (req_exc.SSLError, req_exc.ConnectionError) as exc:
                last_exc = exc
                try:
                    self.session.close()
                except Exception:
                    pass
                self.session = requests.Session()
                self.session.trust_env = False
        else:
            raise RuntimeError(f"下载文件失败: {last_exc}, url={url}") from last_exc

        with resp:
            if resp.status_code != 200:
                raise RuntimeError(f"下载文件失败: HTTP {resp.status_code}, url={url}")
            with save_path.open("wb") as f:
                for chunk in resp.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

    def _split_grid_collage_if_needed(self, local_urls: list[str], expected_n: int) -> list[str]:
        """
        某些网关在 n=4 时不会返回4个URL，而是返回1张 2x2 拼图。
        这里在“期望4张但只拿到1张本地图片”时自动切成4张分别保存。
        """
        if expected_n != 4 or len(local_urls) != 1:
            return local_urls
        only = local_urls[0]
        if not only.startswith("/uploads/images/"):
            return local_urls

        src_path = self.project_root / only.lstrip("/")
        if not src_path.exists():
            return local_urls

        img = cv2.imread(str(src_path))
        if img is None:
            return local_urls
        h, w = img.shape[:2]
        if h < 4 or w < 4:
            return local_urls

        # 有些返回的拼图尺寸是奇数（例如 941x1672），不能要求可整除；
        # 这里用中点切分，剩余像素给下/右侧块。
        hh, ww = h // 2, w // 2
        crops = [
            img[0:hh, 0:ww],       # TL
            img[0:hh, ww:w],       # TR
            img[hh:h, 0:ww],       # BL
            img[hh:h, ww:w],       # BR
        ]

        target_dir = self.uploads_root / "images"
        target_dir.mkdir(parents=True, exist_ok=True)

        out: list[str] = []
        for c in crops:
            filename = f"{uuid4().hex}.png"
            save_path = target_dir / filename
            cv2.imwrite(str(save_path), c)
            out.append(f"/uploads/images/{filename}")

        # 原拼图文件不再需要，删除避免占空间/混淆
        try:
            src_path.unlink(missing_ok=True)
        except Exception:
            pass

        return out


geeknow_service = GeeknowService()
