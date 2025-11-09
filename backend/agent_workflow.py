import json
import os
from typing import Any, Dict, List, Tuple

from .tools import tool_find_activities

try:
    import google.generativeai as genai  # type: ignore
except ImportError:  # pragma: no cover
    genai = None  # type: ignore


_GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
_GEMINI_KEY = os.getenv("GEMINI_API_KEY")
if genai and _GEMINI_KEY:
    genai.configure(api_key=_GEMINI_KEY)


def _collect_keywords(prompt: str, friends: Dict[str, Any]) -> List[str]:
    keywords: List[str] = []
    for part in prompt.replace("•", ",").split(","):
        slot = part.strip()
        if slot:
            keywords.append(slot)

    for profile in friends.values():
        if isinstance(profile, dict):
            likes = profile.get("likes")
            if isinstance(likes, list):
                keywords.extend(str(item) for item in likes if item)

    seen = set()
    unique: List[str] = []
    for kw in keywords:
        token = kw.lower()
        if token not in seen:
            seen.add(token)
            unique.append(kw)
    return unique[:12]


def _call_gemini(prompt: str, friends: Dict[str, Any]) -> Tuple[str, List[str]]:
    if not (genai and _GEMINI_KEY):
        raise RuntimeError("Gemini API key not configured")

    friend_context = json.dumps(friends, indent=2)
    instructions = (
        "You are Challo, an AI concierge planning group activities. "
        "Given a natural language prompt and friend profiles, reply with JSON like "
        '{"summary":"one or two sentences","keywords":["short","terms","here"]}. '
        "Focus keywords on the types of venues or experiences to search."
    )

    model = genai.GenerativeModel(_GEMINI_MODEL)
    response = model.generate_content(
        [
            instructions,
            f"Friend profiles:\n{friend_context}",
            f"User prompt: {prompt}",
        ],
        generation_config={"temperature": 0.4, "response_mime_type": "application/json"},
    )

    text = getattr(response, "text", None)
    if not text:
        all_parts = []
        for cand in getattr(response, "candidates", []) or []:
            for part in getattr(cand, "content", {}).parts or []:
                if part.text:
                    all_parts.append(part.text)
        if not all_parts:
            raise RuntimeError("Gemini returned no text")
        text = "\n".join(all_parts)

    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Gemini returned non-JSON content: {text}") from exc
    summary = str(data.get("summary") or "")
    keywords = data.get("keywords") or []
    if isinstance(keywords, str):
        keywords = [keywords]
    keywords = [str(item) for item in keywords if item]
    return summary, keywords


def agent_discover(prompt: str, location: str | None, budget_cap: float | None, friends: Dict[str, Any]) -> Dict[str, Any]:
    try:
        summary, keywords = _call_gemini(prompt, friends)
    except Exception:
        summary = ""
        keywords = _collect_keywords(prompt, friends)

    if not keywords:
        keywords = _collect_keywords(prompt, friends)

    friend_summary = json.dumps(friends, indent=2)
    if not summary:
        summary = (
            "Blending your crew’s favorites:\n"
            f"{friend_summary}\n"
            f"Here are some ideas matching: {', '.join(keywords) or prompt}."
        )

    filters: Dict[str, Any] = {
        "q": prompt,
        "location": location,
        "budget_cap": budget_cap,
        "likes": keywords,
        "distance_cap": 10,
    }

    activities = tool_find_activities(filters)
    return {"summary": summary, "keywords": keywords, "activities": activities}

