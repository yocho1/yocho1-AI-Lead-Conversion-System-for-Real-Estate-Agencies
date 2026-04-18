import json
import time
import redis

from .config import get_settings


settings = get_settings()
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)


def queue_name_for_agency(agency_id: str) -> str:
    return "events:test" if agency_id == "demo-agency-key" else "events:main"


def enqueue_event(event_id: str, event_type: str, payload: dict, delay_seconds: int = 0) -> None:
    agency_id = str(payload.get("agency_id", ""))
    queue = queue_name_for_agency(agency_id)
    body = json.dumps({"event_id": event_id, "type": event_type, "payload": payload})
    if delay_seconds <= 0:
        redis_client.lpush(queue, body)
        return

    score = int(time.time()) + delay_seconds
    delayed_key = f"{queue}:delayed"
    redis_client.zadd(delayed_key, {body: score})


def release_due_delayed_events(queue: str, max_items: int = 100) -> int:
    delayed_key = f"{queue}:delayed"
    now_score = int(time.time())
    due = redis_client.zrangebyscore(delayed_key, 0, now_score, start=0, num=max_items)
    moved = 0

    for body in due:
        removed = redis_client.zrem(delayed_key, body)
        if removed:
            redis_client.lpush(queue, body)
            moved += 1

    return moved
