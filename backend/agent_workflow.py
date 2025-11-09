import json
import logging
from typing import Any, Dict, List, Tuple

from .adk_client import get_agent_client
from .tools import tool_find_activities

logger = logging.getLogger(__name__)

try:
    from google.genai import types  # type: ignore
except ImportError:  # pragma: no cover
    types = None  # type: ignore


def _fallback_keywords(prompt: str, friends: Dict[str, Any]) -> List[str]:
    """Simple keyword extraction when ADK is unavailable or fails."""
    keywords: List[str] = []
    for part in prompt.replace("•", ",").split(","):
        cleaned = part.strip()
        if cleaned:
            keywords.append(cleaned)
    for profile in friends.values():
        likes = profile.get("likes") if isinstance(profile, dict) else None
        if isinstance(likes, list):
            keywords.extend(str(item) for item in likes if item)
    # deduplicate while preserving order
    seen = set()
    unique: List[str] = []
    for kw in keywords:
        token = kw.lower()
        if token not in seen:
            seen.add(token)
            unique.append(kw)
    return unique[:12]


def _parse_agent_payload(text: str) -> Tuple[str, List[str]]:
    """
    Tries to parse JSON returned by the agent. Falls back to raw text summary and
    keyword extraction.
    """
    try:
        data = json.loads(text)
        summary = str(data.get("summary") or data.get("plan") or "")
        keywords = data.get("keywords") or data.get("queries") or []
        if isinstance(keywords, str):
            keywords = [keywords]
        keywords = [str(item) for item in keywords if item]
        return summary, keywords
    except json.JSONDecodeError:
        return text.strip(), []


def _call_adk(prompt: str, friends: Dict[str, Any]) -> Tuple[str, List[str]]:
    client = get_agent_client()
    if not client or types is None:
        raise RuntimeError("ADK client unavailable")

    friend_context = json.dumps(friends, indent=2)
    instructions = (
        "You are Challo, an AI trip-planning concierge. "
        "Blend friend interests, infer missing details, and respond with JSON "
        "containing 'summary' (string) and 'keywords' (array of 3-6 short terms) "
        "related to activities the group would enjoy."
    )

    session = client.start_session(
        context=types.SessionContext(
            instructions=instructions,
        )
    )

    response = client.update_session(
        session=session,
        messages=[
            types.Message(author="system", content=f"Friend profiles:\n{friend_context}"),
            types.Message(author="user", content=prompt),
        ],
    )

    result_parts: List[str] = []
    if response.result_message:
        for part in getattr(response.result_message, "parts", []):
            text = getattr(part, "text", None)
            if text:
                result_parts.append(text)
        if not result_parts and hasattr(response.result_message, "content"):
            result_parts.append(str(response.result_message.content))

    if not result_parts:
        raise RuntimeError("ADK produced no content")

    combined = "\n".join(result_parts)
    return _parse_agent_payload(combined)


def agent_discover(prompt: str, location: str | None, budget_cap: float | None, friends: Dict[str, Any]) -> Dict[str, Any]:
    try:
        summary, keywords = _call_adk(prompt, friends)
    except Exception as exc:  # pragma: no cover - ensure graceful degradation
        logger.warning("Falling back to heuristic planner: %s", exc)
        summary = ""
        keywords = _fallback_keywords(prompt, friends)

    if not keywords:
        keywords = _fallback_keywords(prompt, friends)

    filters: Dict[str, Any] = {
        "q": prompt,
        "location": location,
        "budget_cap": budget_cap,
        "likes": keywords,
        "distance_cap": 10,
    }

    raw = tool_find_activities(filters)

    return {
        "summary": summary,
        "keywords": keywords,
        "activities": raw,
    }

