from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Awaitable

from .email_provider import send_message as send_email_message
from .sms_provider import send_message as send_sms_message
from .whatsapp_provider import ProviderResult, send_message as send_whatsapp_message

SUPPORTED_CHANNELS = ("whatsapp", "sms", "email")

ProviderFn = Callable[[str, str, dict[str, Any] | None], Awaitable[ProviderResult]]


@dataclass(frozen=True)
class DeliveryAttempt:
    channel: str
    ok: bool
    message: str


@dataclass(frozen=True)
class RoutedDeliveryResult:
    ok: bool
    channel: str | None
    status: str
    attempts: list[DeliveryAttempt]


def _normalize_channel(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().lower()
    if normalized in SUPPORTED_CHANNELS:
        return normalized
    return None


def _channel_sequence(preferred_channel: str | None) -> list[str]:
    preferred = _normalize_channel(preferred_channel)
    if preferred == "email":
        return ["email"]
    if preferred == "sms":
        return ["sms", "email"]
    if preferred == "whatsapp":
        return ["whatsapp", "sms", "email"]
    return ["whatsapp", "sms", "email"]


def _recipient_for_channel(channel: str, lead: dict[str, Any], default_to: str) -> str | None:
    phone = str(lead.get("phone") or "").strip()
    email = str(lead.get("email") or "").strip()

    if channel in {"whatsapp", "sms"}:
        return phone or default_to
    if channel == "email":
        return email or default_to
    return default_to


def _provider_for_channel(channel: str) -> ProviderFn:
    if channel == "whatsapp":
        return send_whatsapp_message
    if channel == "sms":
        return send_sms_message
    return send_email_message


async def route_message(lead: dict[str, Any], to: str, content: str, metadata: dict[str, Any] | None = None) -> RoutedDeliveryResult:
    channels = _channel_sequence(str(lead.get("preferred_channel") or "") or None)
    attempts: list[DeliveryAttempt] = []

    for channel in channels:
        recipient = _recipient_for_channel(channel, lead, to)
        if not recipient:
            attempts.append(DeliveryAttempt(channel=channel, ok=False, message=f"missing recipient for {channel}"))
            continue

        provider = _provider_for_channel(channel)
        try:
            result = await provider(recipient, content, metadata)
        except Exception as exc:  # noqa: BLE001
            attempts.append(DeliveryAttempt(channel=channel, ok=False, message=str(exc)))
            continue

        attempts.append(DeliveryAttempt(channel=channel, ok=result.ok, message=result.message))
        if result.ok:
            return RoutedDeliveryResult(ok=True, channel=channel, status="sent", attempts=attempts)

    return RoutedDeliveryResult(
        ok=False,
        channel=attempts[-1].channel if attempts else None,
        status="failed",
        attempts=attempts,
    )
