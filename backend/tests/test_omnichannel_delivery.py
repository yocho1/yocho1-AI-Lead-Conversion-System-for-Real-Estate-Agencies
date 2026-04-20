import os
import asyncio

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature")

from backend.app import channel_router
from backend.app.whatsapp_provider import ProviderResult


def test_preferred_channel_is_used(monkeypatch) -> None:
    async def sms_ok(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=True, provider="sms", message="sent")

    async def whatsapp_fail(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=False, provider="whatsapp", message="failed")

    monkeypatch.setattr(channel_router, "send_sms_message", sms_ok)
    monkeypatch.setattr(channel_router, "send_whatsapp_message", whatsapp_fail)

    lead = {"preferred_channel": "sms", "phone": "+212600000000", "email": "lead@example.com"}
    result = asyncio.run(channel_router.route_message(lead, "+212600000000", "hello", {}))

    assert result.ok is True
    assert result.channel == "sms"
    assert len(result.attempts) == 1


def test_fallback_whatsapp_to_sms(monkeypatch) -> None:
    async def whatsapp_fail(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=False, provider="whatsapp", message="forced whatsapp failure")

    async def sms_ok(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=True, provider="sms", message="sent")

    monkeypatch.setattr(channel_router, "send_whatsapp_message", whatsapp_fail)
    monkeypatch.setattr(channel_router, "send_sms_message", sms_ok)

    lead = {"phone": "+212611223344", "email": "lead@example.com"}
    result = asyncio.run(channel_router.route_message(lead, "+212611223344", "hello", {}))

    assert result.ok is True
    assert result.channel == "sms"
    assert [attempt.channel for attempt in result.attempts] == ["whatsapp", "sms"]


def test_fallback_sms_to_email(monkeypatch) -> None:
    async def whatsapp_fail(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=False, provider="whatsapp", message="forced whatsapp failure")

    async def sms_fail(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=False, provider="sms", message="forced sms failure")

    async def email_ok(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=True, provider="email", message="sent")

    monkeypatch.setattr(channel_router, "send_whatsapp_message", whatsapp_fail)
    monkeypatch.setattr(channel_router, "send_sms_message", sms_fail)
    monkeypatch.setattr(channel_router, "send_email_message", email_ok)

    lead = {"phone": "+212611223344", "email": "lead@example.com"}
    result = asyncio.run(channel_router.route_message(lead, "+212611223344", "hello", {}))

    assert result.ok is True
    assert result.channel == "email"
    assert [attempt.channel for attempt in result.attempts] == ["whatsapp", "sms", "email"]


def test_all_channels_individual(monkeypatch) -> None:
    async def whatsapp_ok(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=True, provider="whatsapp", message="sent")

    async def sms_ok(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=True, provider="sms", message="sent")

    async def email_ok(to: str, content: str, metadata: dict | None = None) -> ProviderResult:
        return ProviderResult(ok=True, provider="email", message="sent")

    monkeypatch.setattr(channel_router, "send_whatsapp_message", whatsapp_ok)
    monkeypatch.setattr(channel_router, "send_sms_message", sms_ok)
    monkeypatch.setattr(channel_router, "send_email_message", email_ok)

    lead = {"phone": "+212611223344", "email": "lead@example.com"}

    w = asyncio.run(channel_router.route_message({**lead, "preferred_channel": "whatsapp"}, lead["phone"], "hello", {}))
    s = asyncio.run(channel_router.route_message({**lead, "preferred_channel": "sms"}, lead["phone"], "hello", {}))
    e = asyncio.run(channel_router.route_message({**lead, "preferred_channel": "email"}, lead["email"], "hello", {}))

    assert w.ok and w.channel == "whatsapp"
    assert s.ok and s.channel == "sms"
    assert e.ok and e.channel == "email"
