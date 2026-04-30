from __future__ import annotations

from typing import Any

from .supabase_client import get_supabase

supabase = get_supabase()


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


def _extract_city(lead: dict[str, Any]) -> str:
    location = lead.get("location")
    if isinstance(location, dict):
        city = str(location.get("city") or location.get("raw") or "").strip()
        return city.lower()
    return str(lead.get("city") or "").strip().lower()


def _extract_budget(lead: dict[str, Any]) -> float:
    raw_budget = lead.get("budget_value")
    if raw_budget is None:
        raw_budget = lead.get("budget")
    return _to_float(raw_budget, default=0.0)


def _extract_type(lead: dict[str, Any]) -> str:
    return str(lead.get("property_type") or lead.get("type") or "").strip().lower()


def _fetch_candidate_properties(lead: dict[str, Any]) -> list[dict[str, Any]]:
    city = _extract_city(lead)
    budget = _extract_budget(lead)

    if not city or budget <= 0:
        return []

    min_price = budget * 0.9
    max_price = budget * 1.1

    query = (
        supabase.table("properties")
        .select("id,city,price,type,bedrooms")
        .eq("city", city)
        .gte("price", min_price)
        .lte("price", max_price)
    )

    desired_type = _extract_type(lead)
    if desired_type:
        query = query.eq("type", desired_type)

    result = query.execute()
    return result.data or []


def _relevance_score(lead: dict[str, Any], prop: dict[str, Any]) -> float:
    budget = _extract_budget(lead)
    desired_type = _extract_type(lead)
    desired_bedrooms = int(_to_float(lead.get("bedrooms"), default=0.0))

    city_score = 40.0

    if budget <= 0:
        budget_score = 0.0
    else:
        price = _to_float(prop.get("price"), default=0.0)
        max_delta = max(1.0, budget * 0.1)
        delta = abs(price - budget)
        budget_score = max(0.0, 45.0 * (1.0 - (delta / max_delta)))

    type_score = 0.0
    if desired_type and str(prop.get("type") or "").strip().lower() == desired_type:
        type_score = 10.0

    bedroom_score = 0.0
    if desired_bedrooms > 0:
        bedrooms = int(_to_float(prop.get("bedrooms"), default=0.0))
        bedroom_score = max(0.0, 5.0 - abs(bedrooms - desired_bedrooms))

    return city_score + budget_score + type_score + bedroom_score


def match_properties(lead: dict[str, Any], properties: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    city = _extract_city(lead)
    budget = _extract_budget(lead)

    if not city or budget <= 0:
        return []

    min_price = budget * 0.9
    max_price = budget * 1.1
    desired_type = _extract_type(lead)

    candidates = properties if properties is not None else _fetch_candidate_properties(lead)

    filtered: list[dict[str, Any]] = []
    for prop in candidates:
        prop_city = str(prop.get("city") or "").strip().lower()
        price = _to_float(prop.get("price"), default=-1)
        prop_type = str(prop.get("type") or "").strip().lower()

        if prop_city != city:
            continue
        if price < min_price or price > max_price:
            continue
        if desired_type and prop_type != desired_type:
            continue

        enriched = {
            **prop,
            "relevance": round(_relevance_score(lead, prop), 2),
        }
        filtered.append(enriched)

    filtered.sort(key=lambda item: item.get("relevance", 0), reverse=True)
    return filtered


def generate_matching_message(matches: list[dict[str, Any]]) -> str:
    return f"We found {len(matches)} properties matching your needs"
