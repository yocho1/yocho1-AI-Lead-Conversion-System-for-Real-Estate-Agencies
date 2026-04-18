from __future__ import annotations

from typing import Any


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return max(min_value, min(max_value, value))


def _to_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        digits = "".join(ch for ch in value if ch.isdigit() or ch == ".")
        if not digits:
            return default
        try:
            return float(digits)
        except ValueError:
            return default
    return default


def _budget_score(lead: dict[str, Any]) -> float:
    raw_budget = lead.get("budget_value")
    if raw_budget is None:
        raw_budget = lead.get("budget")
    budget = _to_float(raw_budget, default=0.0)

    # Normalize to a practical real-estate range where 2M+ is maxed.
    normalized = (budget / 2_000_000.0) * 100.0
    return _clamp(normalized, 0.0, 100.0)


def _timeline_score(lead: dict[str, Any]) -> float:
    timeline = str(lead.get("timeline_normalized") or lead.get("timeline") or "").strip().lower()
    if not timeline:
        return 20.0

    mapping: dict[str, float] = {
        "asap": 100.0,
        "today": 100.0,
        "tomorrow": 95.0,
        "this_week": 90.0,
        "next_week": 75.0,
        "this_month": 60.0,
        "next_month": 45.0,
        "this_quarter": 30.0,
        "next_quarter": 25.0,
        "6_months": 20.0,
        "12_months": 10.0,
        "later": 10.0,
    }

    if timeline in mapping:
        return mapping[timeline]

    if "week" in timeline:
        return 80.0
    if "month" in timeline:
        return 50.0
    if "quarter" in timeline:
        return 25.0

    # Invalid/unrecognized timeline values are treated as low urgency.
    return 15.0


def _response_time_score(response_time_seconds: float) -> float:
    if response_time_seconds <= 60:
        return 100.0
    if response_time_seconds <= 300:
        return 80.0
    if response_time_seconds <= 900:
        return 60.0
    if response_time_seconds <= 1800:
        return 40.0
    if response_time_seconds <= 3600:
        return 20.0
    return 0.0


def _engagement_score(lead: dict[str, Any]) -> float:
    messages_count = _to_float(lead.get("messages_count"), default=0.0)
    avg_response_time_seconds = _to_float(lead.get("avg_response_time_seconds"), default=1800.0)

    # Message volume saturates at ~20 messages.
    message_score = _clamp((messages_count / 20.0) * 100.0, 0.0, 100.0)
    response_score = _response_time_score(avg_response_time_seconds)

    # Slightly favor message volume while still rewarding fast replies.
    return _clamp((message_score * 0.6) + (response_score * 0.4), 0.0, 100.0)


def _classify(score: int) -> str:
    if score >= 70:
        return "HOT"
    if score >= 40:
        return "WARM"
    return "COLD"


def _action_for_category(category: str) -> str:
    if category == "HOT":
        return "send_whatsapp"
    if category == "WARM":
        return "schedule_followup"
    return "none"


def decide_next_action(lead: dict[str, Any]) -> dict[str, Any]:
    budget_score = _budget_score(lead)
    timeline_score = _timeline_score(lead)
    engagement_score = _engagement_score(lead)

    weighted_score = (budget_score * 0.4) + (timeline_score * 0.3) + (engagement_score * 0.3)
    score = int(round(_clamp(weighted_score, 0.0, 100.0)))

    category = _classify(score)
    action = _action_for_category(category)

    return {
        "score": score,
        "category": category,
        "action": action,
    }
