from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from .config import get_settings


@dataclass(frozen=True)
class ProviderResult:
    ok: bool
    provider: str
    message: str


async def send_message(to: str, content: str, metadata: dict[str, Any] | None = None) -> ProviderResult:
    settings = get_settings()
    payload = {
        "to": to,
        "message": content,
        "metadata": metadata or {},
    }
    headers = {"Authorization": f"Bearer {settings.whatsapp_api_key}"}

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(settings.whatsapp_api_url, json=payload, headers=headers)
        response.raise_for_status()

    return ProviderResult(ok=True, provider="whatsapp", message="sent")
