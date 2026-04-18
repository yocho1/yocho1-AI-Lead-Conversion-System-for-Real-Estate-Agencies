import json
from abc import ABC, abstractmethod
from dataclasses import dataclass

import httpx

from .config import get_settings


@dataclass(frozen=True)
class ProviderResponse:
    ok: bool
    provider: str
    message: str


class NotificationProvider(ABC):
    @abstractmethod
    async def send(self, message: str, recipient: str) -> ProviderResponse:
        raise NotImplementedError


class TestProvider(NotificationProvider):
    async def send(self, message: str, recipient: str) -> ProviderResponse:
        return ProviderResponse(ok=True, provider="test", message=f"test mode: {recipient}")


class WhatsAppProvider(NotificationProvider):
    def __init__(self) -> None:
        self.settings = get_settings()

    async def send(self, message: str, recipient: str) -> ProviderResponse:
        payload = {"to": recipient, "message": message}
        headers = {"Authorization": f"Bearer {self.settings.whatsapp_api_key}"}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(self.settings.whatsapp_api_url, json=payload, headers=headers)
            response.raise_for_status()
        return ProviderResponse(ok=True, provider="whatsapp", message="sent")


class EmailProvider(NotificationProvider):
    def __init__(self) -> None:
        self.settings = get_settings()

    async def send(self, message: str, recipient: str) -> ProviderResponse:
        if not self.settings.email_api_url:
            return ProviderResponse(ok=False, provider="email", message="EMAIL_API_URL not configured")
        headers = {"Authorization": f"Bearer {self.settings.email_api_key}"}
        payload = {"to": recipient, "subject": "Lead Alert", "text": message}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(self.settings.email_api_url, json=payload, headers=headers)
            response.raise_for_status()
        return ProviderResponse(ok=True, provider="email", message="sent")


class SMSProvider(NotificationProvider):
    def __init__(self) -> None:
        self.settings = get_settings()

    async def send(self, message: str, recipient: str) -> ProviderResponse:
        if not self.settings.sms_api_url:
            return ProviderResponse(ok=False, provider="sms", message="SMS_API_URL not configured")
        headers = {"Authorization": f"Bearer {self.settings.sms_api_key}"}
        payload = {"to": recipient, "message": message}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(self.settings.sms_api_url, json=payload, headers=headers)
            response.raise_for_status()
        return ProviderResponse(ok=True, provider="sms", message="sent")


def _load_overrides(raw_json: str) -> dict:
    if not raw_json.strip():
        return {}
    try:
        parsed = json.loads(raw_json)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def resolve_provider(channel: str, agency_id: str) -> NotificationProvider:
    if agency_id == "demo-agency-key":
        return TestProvider()

    settings = get_settings()
    overrides = _load_overrides(settings.tenant_provider_overrides)
    agency_override = overrides.get(agency_id, {}) if isinstance(overrides.get(agency_id, {}), dict) else {}
    provider_name = str(agency_override.get(channel, "")).lower().strip()

    if channel == "whatsapp":
        if provider_name in {"test", "mock"}:
            return TestProvider()
        return WhatsAppProvider()

    if channel == "email":
        if provider_name in {"test", "mock"}:
            return TestProvider()
        return EmailProvider()

    if channel == "sms":
        if provider_name in {"test", "mock"}:
            return TestProvider()
        return SMSProvider()

    return TestProvider()
