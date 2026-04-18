from supabase import Client, create_client

from .config import get_settings


_settings = get_settings()
_supabase: Client = create_client(_settings.supabase_url, _settings.supabase_service_role_key)


def get_supabase() -> Client:
    return _supabase
