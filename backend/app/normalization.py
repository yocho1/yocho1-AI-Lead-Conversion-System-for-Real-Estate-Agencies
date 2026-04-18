import re

INVALID_LOCATION = {"ok", "and", "test"}


TIMELINE_MAP = {
    "today": "asap",
    "tomorrow": "asap",
    "next day": "asap",
    "this week": "this_week",
    "next month": "next_month",
}


def normalize_budget(value: int | None) -> int | None:
    if value is None:
        return None
    if value < 10000:
        raise ValueError("budget must be >= 10000")
    return value


def normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip()


def normalize_name(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = value.strip()
    if len(cleaned) < 2:
        raise ValueError("name too short")
    return cleaned


def normalize_location(raw: str | None, city: str | None, country: str | None) -> dict:
    raw_clean = (raw or "").strip().lower()
    if raw_clean in INVALID_LOCATION:
        raise ValueError("invalid location")

    if raw and "," in raw:
        parts = [part.strip() for part in raw.split(",", 1)]
        country = country or (parts[0].title() if parts[0] else None)
        city = city or (parts[1].title() if len(parts) > 1 and parts[1] else None)

    if raw and not city and not country:
        tokens = re.split(r"\s+", raw.strip())
        if len(tokens) == 1:
            city = tokens[0].title()

    return {
        "raw": raw,
        "city": city,
        "country": country,
    }


def normalize_timeline(value: str | None) -> tuple[str | None, str | None]:
    if not value:
        return None, None
    lower = value.strip().lower()
    return value.strip(), TIMELINE_MAP.get(lower, lower.replace(" ", "_"))


def compute_status(budget: int | None, has_contact: bool, timeline_normalized: str | None) -> str:
    if budget and budget >= 50000 and has_contact and bool(timeline_normalized):
        return "hot"
    return "cold"
