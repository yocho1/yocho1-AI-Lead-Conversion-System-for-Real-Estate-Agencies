from backend.app.decision_engine import decide_next_action


def test_hot_lead() -> None:
    lead = {
        "budget": 2_100_000,
        "timeline_normalized": "asap",
        "messages_count": 18,
        "avg_response_time_seconds": 45,
    }

    result = decide_next_action(lead)

    assert result["score"] >= 70
    assert result["category"] == "HOT"
    assert result["action"] == "send_whatsapp"


def test_warm_lead() -> None:
    lead = {
        "budget": 700_000,
        "timeline_normalized": "next_month",
        "messages_count": 10,
        "avg_response_time_seconds": 700,
    }

    result = decide_next_action(lead)

    assert 40 <= result["score"] <= 69
    assert result["category"] == "WARM"
    assert result["action"] == "schedule_followup"


def test_cold_lead() -> None:
    lead = {
        "budget": 120_000,
        "timeline_normalized": "12_months",
        "messages_count": 1,
        "avg_response_time_seconds": 7200,
    }

    result = decide_next_action(lead)

    assert result["score"] < 40
    assert result["category"] == "COLD"
    assert result["action"] == "none"


def test_missing_budget() -> None:
    lead = {
        "timeline_normalized": "next_week",
        "messages_count": 8,
        "avg_response_time_seconds": 300,
    }

    result = decide_next_action(lead)

    assert isinstance(result["score"], int)
    assert result["category"] in {"HOT", "WARM", "COLD"}


def test_invalid_timeline() -> None:
    lead = {
        "budget": 850_000,
        "timeline_normalized": "whenever_maybe",
        "messages_count": 9,
        "avg_response_time_seconds": 900,
    }

    result = decide_next_action(lead)

    assert isinstance(result["score"], int)
    assert result["action"] in {"send_whatsapp", "schedule_followup", "none"}
