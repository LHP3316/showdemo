from __future__ import annotations

from app.config import settings


def to_public_media_url(url: str | None) -> str | None:
    text = str(url or "").strip()
    if not text:
        return None

    normalized = text.replace("\\", "/")
    lower = normalized.lower()

    # 已经是完整 URL，直接返回
    if lower.startswith("http://") or lower.startswith("https://"):
        return normalized

    marker = "/uploads/"
    idx = lower.find(marker)
    if idx < 0 and lower.startswith("uploads/"):
        normalized = f"/{normalized}"
        idx = normalized.lower().find(marker)
    if idx < 0:
        return normalized

    rel = normalized[idx:]
    base = str(getattr(settings, "MEDIA_PUBLIC_BASE_URL", "") or "").strip().rstrip("/")
    if not base:
        return rel
    return f"{base}{rel}"


def normalize_media_url_list(values) -> list[str]:
    if not isinstance(values, list):
        return []
    out: list[str] = []
    for item in values:
        mapped = to_public_media_url(str(item or ""))
        if mapped:
            out.append(mapped)
    return out
