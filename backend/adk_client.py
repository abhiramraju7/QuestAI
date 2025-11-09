from functools import lru_cache
import os
from typing import Optional

from google.auth import default

try:
    from google.genai import AgentClient
except ImportError:  # pragma: no cover
    AgentClient = None  # type: ignore


@lru_cache(maxsize=1)
def get_agent_client() -> Optional["AgentClient"]:
    """
    Returns a cached Google ADK AgentClient instance when the library and
    credentials are available. Falls back to None so callers can handle the
    absence of ADK gracefully (e.g. local dev without credentials).
    """

    if AgentClient is None:
        return None

    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        return None

    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")

    credentials, _ = default()

    try:
        return AgentClient(project=project_id, location=location, credentials=credentials)
    except Exception:  # pragma: no cover - defensive; surface failures upstream
        return None

