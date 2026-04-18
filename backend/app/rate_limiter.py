import time

import redis

from .config import get_settings


settings = get_settings()
redis_client = redis.Redis.from_url(settings.redis_url, decode_responses=True)


class RateLimitExceededError(RuntimeError):
    pass


def enforce_per_tenant_rate_limit(agency_id: str, channel: str) -> None:
    if agency_id == "demo-agency-key":
        return

    max_per_second = max(1, settings.max_notifications_per_second)
    now_sec = int(time.time())
    key = f"rl:{channel}:{agency_id}:{now_sec}"

    current = redis_client.incr(key)
    if current == 1:
        redis_client.expire(key, 2)

    if current > max_per_second:
        raise RateLimitExceededError(
            f"rate limit exceeded for agency={agency_id} channel={channel} limit={max_per_second}/s"
        )
