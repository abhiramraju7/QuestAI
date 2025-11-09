import os
import logging
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client  # type: ignore

logger = logging.getLogger(__name__)


class SupabaseConfigError(RuntimeError):
    """Raised when Supabase environment variables are missing."""


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise SupabaseConfigError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY) "
            "must be defined in the environment."
        )

    logger.info("Initialising Supabase client.")
    return create_client(url, key)


def safe_get_supabase_client() -> Optional[Client]:
    try:
        return get_supabase_client()
    except SupabaseConfigError as exc:
        logger.error("Supabase configuration error: %s", exc)
    except Exception as exc:  # pylint: disable=broad-except
        logger.exception("Failed to initialise Supabase client: %s", exc)
    return None

