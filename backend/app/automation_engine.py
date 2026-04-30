from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from .channel_router import route_message
from .logging_store import log_event
from .supabase_client import get_supabase


def _parse_json(value: Any) -> dict[str, Any] | None:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return None

    raw = value.strip()
    if not raw or not raw.startswith("{"):
        return None

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return None

    return parsed if isinstance(parsed, dict) else None


def _resolve_path(data: dict[str, Any], path: str) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return None
        current = current[part]
    return current


def _evaluate_dict_condition(condition: dict[str, Any], context: dict[str, Any]) -> bool:
    field = str(condition.get("field") or "").strip()
    operator = str(condition.get("operator") or "eq").strip().lower()
    expected = condition.get("value")

    if not field:
        return True

    actual = _resolve_path(context, field)

    if operator in {"eq", "="}:
        return str(actual).lower() == str(expected).lower()
    if operator in {"ne", "!="}:
        return str(actual).lower() != str(expected).lower()
    if operator == "contains":
        return str(expected).lower() in str(actual).lower()

    return False


def _evaluate_expression_condition(condition: str, context: dict[str, Any]) -> bool:
    expression = condition.strip()
    if not expression:
        return True

    match = re.match(r"^([a-zA-Z0-9_.]+)\s*(=|==|!=)\s*['\"]?(.+?)['\"]?$", expression)
    if not match:
        return False

    field, operator, expected = match.groups()
    actual = _resolve_path(context, field)

    if operator in {"=", "=="}:
        return str(actual).lower() == str(expected).lower()
    return str(actual).lower() != str(expected).lower()


def _evaluate_condition(raw_condition: Any, context: dict[str, Any]) -> bool:
    if raw_condition is None:
        return True

    parsed = _parse_json(raw_condition)
    if parsed is not None:
        return _evaluate_dict_condition(parsed, context)

    return _evaluate_expression_condition(str(raw_condition), context)


def _normalize_action(raw_action: Any) -> dict[str, Any]:
    parsed = _parse_json(raw_action)
    if parsed is not None:
        return parsed

    action_text = str(raw_action or "").strip().lower()
    if "whatsapp" in action_text:
        return {"type": "send_whatsapp"}

    return {"type": "unknown"}


def _load_lead(lead_id: str) -> dict[str, Any] | None:
    supabase = get_supabase()
    response = (
        supabase.table("leads")
        .select("id,name,email,phone,status,lead_category,preferred_channel")
        .eq("id", lead_id)
        .limit(1)
        .execute()
    )
    rows = response.data or []
    return rows[0] if rows else None


def _build_context(event_payload: dict[str, Any], lead: dict[str, Any] | None) -> dict[str, Any]:
    lead_status = str((lead or {}).get("status") or "").upper()
    lead_category = str((lead or {}).get("lead_category") or lead_status or "").upper()

    return {
        "event": event_payload,
        "lead": {
            "id": (lead or {}).get("id"),
            "name": (lead or {}).get("name"),
            "email": (lead or {}).get("email"),
            "phone": (lead or {}).get("phone"),
            "status": lead_status,
            "category": lead_category,
        },
    }


async def _execute_send_whatsapp(
    lead: dict[str, Any],
    message: str,
    event_type: str,
    automation_id: str,
) -> dict[str, Any]:
    phone = str(lead.get("phone") or "").strip()
    if not phone:
        return {"ok": False, "status": "skipped", "reason": "lead has no phone"}

    lead_for_delivery = dict(lead)
    lead_for_delivery["preferred_channel"] = "whatsapp"

    delivery = await route_message(
        lead=lead_for_delivery,
        to=phone,
        content=message,
        metadata={"event_type": event_type, "automation_id": automation_id},
    )

    return {
        "ok": bool(delivery.ok),
        "status": delivery.status,
        "channel": delivery.channel,
    }


def run_automations_for_event(event_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    supabase = get_supabase()
    agency_id = str(payload.get("agency_id") or "")
    lead_id = str(payload.get("lead_id") or "")

    if not agency_id or not lead_id:
        return {"matched": 0, "executed": 0, "details": []}

    rules_result = (
        supabase.table("automations")
        .select("id,trigger,condition,action")
        .eq("agency_id", agency_id)
        .eq("trigger", event_type)
        .execute()
    )
    rules = rules_result.data or []

    if not rules:
        return {"matched": 0, "executed": 0, "details": []}

    lead = _load_lead(lead_id)
    if not lead:
        return {"matched": len(rules), "executed": 0, "details": [{"status": "skipped", "reason": "lead not found"}]}

    context = _build_context(payload, lead)
    executed = 0
    details: list[dict[str, Any]] = []

    for rule in rules:
        automation_id = str(rule.get("id"))
        condition = rule.get("condition")

        if not _evaluate_condition(condition, context):
            details.append({"automation_id": automation_id, "status": "condition_not_met"})
            continue

        action = _normalize_action(rule.get("action"))
        action_type = str(action.get("type") or "unknown").lower()

        if action_type != "send_whatsapp":
            details.append({"automation_id": automation_id, "status": "unsupported_action", "action_type": action_type})
            continue

        message = str(action.get("message") or "A new hot lead needs immediate follow-up on WhatsApp.")
        result = asyncio.run(_execute_send_whatsapp(lead, message, event_type, automation_id))

        if result.get("ok"):
            executed += 1
            log_event(agency_id, lead_id, event_type, "automation_executed", f"Automation {automation_id} executed via WhatsApp")
        else:
            log_event(
                agency_id,
                lead_id,
                event_type,
                "automation_failed",
                f"Automation {automation_id} failed: {result.get('reason', result.get('status', 'unknown'))}",
            )

        details.append({"automation_id": automation_id, **result})

    return {"matched": len(rules), "executed": executed, "details": details}
