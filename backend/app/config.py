from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    redis_url: str
    whatsapp_api_url: str
    whatsapp_api_key: str
    email_api_url: str
    email_api_key: str
    sms_api_url: str
    sms_api_key: str
    tenant_provider_overrides: str
    max_notifications_per_second: int
    default_currency: str



def get_settings() -> Settings:
    supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    if not supabase_url or not supabase_service_role_key:
        raise RuntimeError("Missing Supabase env vars")

    return Settings(
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_service_role_key,
        redis_url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        whatsapp_api_url=os.getenv("WHATSAPP_API_URL", "https://example-whatsapp-provider/send"),
        whatsapp_api_key=os.getenv("WHATSAPP_API_KEY", ""),
        email_api_url=os.getenv("EMAIL_API_URL", ""),
        email_api_key=os.getenv("EMAIL_API_KEY", ""),
        sms_api_url=os.getenv("SMS_API_URL", ""),
        sms_api_key=os.getenv("SMS_API_KEY", ""),
        tenant_provider_overrides=os.getenv("TENANT_PROVIDER_OVERRIDES", ""),
        max_notifications_per_second=max(1, int(os.getenv("MAX_NOTIFICATIONS_PER_SECOND", "5"))),
        default_currency=os.getenv("DEFAULT_CURRENCY", "USD"),
    )
