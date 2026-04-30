import os

os.environ.setdefault("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature")

from backend.app.matching_engine import generate_matching_message, match_properties


def test_matching_accuracy_city_budget_and_sorting() -> None:
    lead = {
        "location": {"city": "casablanca"},
        "budget": 1_000_000,
        "property_type": "apartment",
        "bedrooms": 3,
    }

    sample_properties = [
        {"id": "p1", "city": "casablanca", "price": 900000, "type": "apartment", "bedrooms": 2},
        {"id": "p2", "city": "casablanca", "price": 1000000, "type": "apartment", "bedrooms": 3},
        {"id": "p3", "city": "casablanca", "price": 1080000, "type": "apartment", "bedrooms": 3},
        {"id": "p4", "city": "casablanca", "price": 1200000, "type": "villa", "bedrooms": 4},
        {"id": "p5", "city": "rabat", "price": 980000, "type": "apartment", "bedrooms": 3},
    ]

    matches = match_properties(lead, sample_properties)

    assert [item["id"] for item in matches] == ["p2", "p3", "p1"]
    assert all(item["city"] == "casablanca" for item in matches)
    assert all(900000 <= item["price"] <= 1100000 for item in matches)


def test_no_results_edge_case() -> None:
    lead = {
        "location": {"city": "marrakesh"},
        "budget": 500000,
        "property_type": "villa",
    }
    sample_properties = [
        {"id": "p1", "city": "casablanca", "price": 900000, "type": "apartment", "bedrooms": 2},
        {"id": "p2", "city": "rabat", "price": 600000, "type": "villa", "bedrooms": 3},
    ]

    matches = match_properties(lead, sample_properties)

    assert matches == []
    assert generate_matching_message(matches) == "We found 0 properties matching your needs"


def test_ai_message_generation() -> None:
    matches = [{"id": "p1"}, {"id": "p2"}, {"id": "p3"}]
    assert generate_matching_message(matches) == "We found 3 properties matching your needs"
