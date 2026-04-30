from __future__ import annotations

from typing import Any

import httpx

from .config import get_settings
from .whatsapp_provider import ProviderResult


async def send_message(to: str, content: str, metadata: dict[str, Any] | None = None) -> ProviderResult:
    settings = get_settings()
    if not settings.sms_api_url:
        return ProviderResult(ok=False, provider="sms", message="SMS_API_URL not configured")

    payload = {
        "to": to,
        "message": content,
        "metadata": metadata or {},
    }
    headers = {"Authorization": f"Bearer {settings.sms_api_key}"}

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(settings.sms_api_url, json=payload, headers=headers)
        response.raise_for_status()

    return ProviderResult(ok=True, provider="sms", message="sent")
