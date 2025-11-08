# These are the callable “functions” the LLM will use.
# In dev, they can return mock data; Friend 2 will later wire real APIs.

import os
import re
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from functools import lru_cache

import httpx
from backend.schemas import UserTaste

logger = logging.getLogger(__name__)

# === Data-access contracts Friend 2 will implement for real ===
def tool_get_user_taste(user_id: str) -> UserTaste:
    # TODO: replace with Supabase fetch
    MOCK = {
        "u1": UserTaste(
            user_id="u1",
            likes=["live music", "coffee tastings", "gallery pop-ups"],
            vibes=["music", "creative", "social"],
            budget_max=25,
            distance_km_max=4,
            tags=["indoor", "night"],
        ),
        "u2": UserTaste(
            user_id="u2",
            likes=["sunset walks", "outdoor markets", "kayaking"],
            vibes=["outdoors", "adventure", "chill"],
            budget_max=10,
            distance_km_max=6,
            tags=["free", "daytime"],
        ),
        "u3": UserTaste(
            user_id="u3",
            likes=["board games", "indie films", "tea houses"],
            vibes=["quiet", "nerdy", "mindful"],
            budget_max=15,
            distance_km_max=3,
            tags=["indoor", "cozy"],
        ),
    }
    return MOCK.get(user_id, UserTaste(user_id=user_id))

def tool_merge_tastes(tastes: List[UserTaste]) -> Dict[str, Any]:
    # naive weighted union for hackathon speed
    from collections import Counter

    vibes = Counter(v for t in tastes for v in t.vibes).most_common()
    merged_vibe = (vibes[0][0] if vibes else "chill")

    budgets = [t.budget_max for t in tastes if t.budget_max is not None]
    budget = min(budgets) if budgets else 30  # default to <$30 if unknown

    distance_values = [t.distance_km_max for t in tastes if t.distance_km_max is not None]
    distance = min(distance_values) if distance_values else 5

    likes = list({l for t in tastes for l in t.likes})
    tags = list({tg for t in tastes for tg in t.tags})
    return {
        "merged_vibe": merged_vibe,
        "budget_cap": budget,
        "distance_cap": distance,
        "likes": likes,
        "tags": tags,
    }

def _google_price_to_band(price_level: Optional[int]) -> Optional[str]:
    mapping = {
        0: "free",
        1: "$",
        2: "$$",
        3: "$$$",
        4: "$$$$",
    }
    return mapping.get(price_level) if price_level is not None else None


def _budget_cap_to_price_level(budget_cap: Optional[float]) -> Optional[int]:
    if budget_cap is None:
        return None
    if budget_cap <= 0:
        return 0
    if budget_cap <= 15:
        return 1
    if budget_cap <= 30:
        return 2
    if budget_cap <= 60:
        return 3
    return 4


def _price_band_to_level(price: Optional[str]) -> Optional[int]:
    if not price:
        return None
    normalized = price.lower()
    if normalized == "free":
        return 0
    return normalized.count("$")


def _geocode_location(location: Optional[str]) -> Optional[Tuple[float, float]]:
    if not location:
        return None

    api_key = os.getenv("GOOGLE_PLACES_API_KEY") or os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        return None

    try:
        resp = httpx.get(
            "https://maps.googleapis.com/maps/api/geocode/json",
            params={"address": location, "key": api_key},
            timeout=10.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data.get("results"):
            geometry = data["results"][0]["geometry"]["location"]
            return geometry["lat"], geometry["lng"]
        if data.get("status") != "OK":
            logger.warning("Geocode lookup returned status %s", data.get("status"))
    except Exception as exc:
        logger.error("Geocode lookup failed: %s", exc)
        return None

    return None


def _parse_time_window(time_window: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not time_window:
        return None, None

    window = time_window.lower()
    now = datetime.now()

    base = now
    if "tomorrow" in window:
        base = now + timedelta(days=1)
    elif "next" in window and "day" in window:
        base = now + timedelta(days=1)

    times = re.findall(r"(\d{1,2})(?::(\d{2}))?\s*(am|pm)", window)
    start_iso: Optional[str] = None
    end_iso: Optional[str] = None

    def to_datetime(match: Tuple[str, Optional[str], str]) -> datetime:
        hour = int(match[0])
        minute = int(match[1]) if match[1] else 0
        meridian = match[2]
        if meridian == "pm" and hour != 12:
            hour += 12
        if meridian == "am" and hour == 12:
            hour = 0
        dt = base.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if dt < now:
            dt += timedelta(days=1)
        return dt

    if times:
        start_dt = to_datetime(times[0])
        start_iso = start_dt.isoformat()
        if len(times) > 1:
            end_dt = to_datetime(times[1])
            if end_dt <= start_dt:
                end_dt += timedelta(hours=2)
            end_iso = end_dt.isoformat()
        elif "before" in window:
            end_iso = start_dt.isoformat()
            start_iso = None
    else:
        if "morning" in window:
            start_iso = base.replace(hour=8, minute=0, second=0, microsecond=0).isoformat()
            end_iso = base.replace(hour=12, minute=0, second=0, microsecond=0).isoformat()
        elif "afternoon" in window:
            start_iso = base.replace(hour=12, minute=0, second=0, microsecond=0).isoformat()
            end_iso = base.replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
        elif "evening" in window or "tonight" in window:
            start_iso = base.replace(hour=17, minute=0, second=0, microsecond=0).isoformat()
            end_iso = base.replace(hour=22, minute=0, second=0, microsecond=0).isoformat()

    return start_iso, end_iso


def _fetch_google_places(query: Dict[str, Any]) -> List[Dict[str, Any]]:
    api_key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not api_key:
        return []

    coords = _geocode_location(query.get("location"))
    radius_km = query.get("distance_cap") or 5
    radius_m = min(max(int(radius_km * 1000), 1000), 50000)

    keyword_parts: List[str] = []
    if query.get("vibe"):
        keyword_parts.append(str(query["vibe"]))
    keyword_parts.extend(query.get("likes") or [])
    keyword_parts.extend(query.get("tags") or [])
    keyword = " ".join(keyword_parts) or "activities"

    price_level_cap = _budget_cap_to_price_level(query.get("budget_cap"))

    results: List[Dict[str, Any]] = []
    try:
        with httpx.Client(timeout=10.0) as client:
            if coords:
                params = {
                    "location": f"{coords[0]},{coords[1]}",
                    "radius": radius_m,
                    "keyword": keyword,
                    "key": api_key,
                    "language": "en",
                }
                if query.get("time_window"):
                    params["opennow"] = "true"
                resp = client.get(
                    "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
                    params=params,
                )
            else:
                resp = client.get(
                    "https://maps.googleapis.com/maps/api/place/textsearch/json",
                    params={
                        "query": f"{keyword} {query.get('location') or ''}".strip(),
                        "radius": radius_m,
                        "key": api_key,
                        "language": "en",
                        "region": "us",
                    },
                )
            resp.raise_for_status()
            data = resp.json()
            status = data.get("status")
            if status not in {"OK", "ZERO_RESULTS"}:
                logger.warning("Google Places returned status %s: %s", status, data.get("error_message"))
    except Exception as exc:
        logger.error("Google Places fetch failed: %s", exc)
        return []

    for place in data.get("results", [])[:20]:
        geometry = place.get("geometry", {}).get("location", {})
        price_band = _google_price_to_band(place.get("price_level")) or "unknown"

        if price_level_cap is not None:
            level = _price_band_to_level(price_band)
            if level is not None and level > price_level_cap:
                continue

        results.append(
            {
                "title": place.get("name"),
                "vibe": query.get("vibe") or (place.get("types") or [None])[0],
                "price": price_band,
                "address": place.get("vicinity") or place.get("formatted_address"),
                "lat": geometry.get("lat"),
                "lng": geometry.get("lng"),
                "distance_km": None,
                "booking_url": place.get("website")
                or f"https://maps.google.com/?q={place.get('place_id')}",
                "maps_url": f"https://www.google.com/maps/search/?api=1&query={geometry.get('lat')},{geometry.get('lng')}",
                "source": "google_places",
                "tags": place.get("types") or [],
                "summary": place.get("editorial_summary", {}).get("overview")
                or place.get("business_status")
                or f"Discover {place.get('name')} via Google Places.",
            }
        )
    return results


def _fetch_eventbrite_events(query: Dict[str, Any]) -> List[Dict[str, Any]]:
    token = os.getenv("EVENTBRITE_API_KEY")
    if not token:
        return []

    coords = _geocode_location(query.get("location"))
    start_iso, end_iso = _parse_time_window(query.get("time_window"))

    search_terms: List[str] = []
    if query.get("vibe"):
        search_terms.append(str(query["vibe"]))
    search_terms.extend(query.get("likes") or [])
    search_terms.extend(query.get("tags") or [])

    seen = set()
    deduped_terms: List[str] = []
    for term in search_terms:
        normalized = term.strip()
        if not normalized:
            continue
        lowered = normalized.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        deduped_terms.append(normalized)
    search_terms = deduped_terms[:6]  # keep keyword string short for Eventbrite

    params: Dict[str, Any] = {
        "expand": "venue,category,subcategory,format",
        "q": " ".join(t for t in search_terms if t).strip() or "activities",
        "sort_by": "date",
        "page_size": 25,
    }

    use_address_fallback = False
    if coords:
        params["location.latitude"] = coords[0]
        params["location.longitude"] = coords[1]
        radius_km = query.get("distance_cap") or 10
        radius_mi = max(1, min(int(round((radius_km or 0) * 0.621371)), 50))
        params["location.within"] = f"{radius_mi}mi"
    elif query.get("location"):
        params["location.address"] = query["location"]
        use_address_fallback = True

    budget_cap = query.get("budget_cap")
    if budget_cap is not None:
        if budget_cap <= 0:
            params["price"] = "free"
        elif budget_cap <= 35:
            params["price"] = "paid"

    def _ensure_z(value: Optional[str]) -> Optional[str]:
        if not value:
            return value
        return value if value.endswith(("Z", "z")) else f"{value}Z"

    start_iso = _ensure_z(start_iso)
    end_iso = _ensure_z(end_iso)

    if start_iso:
        params["start_date.range_start"] = start_iso
    if end_iso:
        params["start_date.range_end"] = end_iso

    def _query_eventbrite(search_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        try:
            resp = httpx.get(
                "https://www.eventbriteapi.com/v3/events/search/",
                params=search_params,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            if data.get("error_description"):
                logger.warning("Eventbrite error: %s", data["error_description"])
            return data
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 404 and not use_address_fallback and query.get("location"):
                # Retry with address fallback if coordinates caused an error
                fallback_params = dict(search_params)
                fallback_params.pop("location.latitude", None)
                fallback_params.pop("location.longitude", None)
                fallback_params.pop("location.within", None)
                fallback_params["location.address"] = query["location"]
                logger.info("Eventbrite 404 with coordinates; retrying with address fallback.")
                return _query_eventbrite(fallback_params)
            logger.error("Eventbrite fetch failed with status %s: %s", exc.response.status_code, exc)
            return None
        except Exception as exc:
            logger.error("Eventbrite fetch failed: %s", exc)
            return None

    data = _query_eventbrite(params)
    if not data:
        return []

    events: List[Dict[str, Any]] = []
    for event in data.get("events", []):
        venue = event.get("venue") or {}
        category = event.get("category", {})
        is_free = event.get("is_free", False)
        events.append(
            {
                "title": event.get("name", {}).get("text"),
                "vibe": query.get("vibe") or (category.get("short_name") if category else None),
                "price": "free" if is_free else "$$",
                "address": venue.get("address", {}).get("localized_address_display"),
                "lat": venue.get("latitude"),
                "lng": venue.get("longitude"),
                "distance_km": None,
                "booking_url": event.get("url"),
                "source": "eventbrite",
                "tags": [category.get("short_name")] if category else [],
                "summary": event.get("summary") or event.get("description", {}).get("text"),
                "maps_url": (
                    f"https://www.google.com/maps/search/?api=1&query={venue.get('latitude')},{venue.get('longitude')}"
                    if venue.get("latitude") and venue.get("longitude")
                    else None
                ),
            }
        )
    return events


def tool_find_activities(query: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Input keys (example): {
      "location": "Cambridge, MA", "vibe": "outdoors", "budget_cap": 20,
      "time_window": "today 4-8pm", "likes": ["sunset","live music"], "tags":["free"]
    }
    Return raw candidates; Writer will turn into PlanCard.
    """
    google_results = _fetch_google_places(query)
    event_results = _fetch_eventbrite_events(query)

    combined_map: Dict[str, Dict[str, Any]] = {}
    for item in google_results + event_results:
        key = f"{item.get('title','').lower()}::{item.get('address','').lower()}"
        combined_map[key] = item

    combined = list(combined_map.values())
    if combined:
        return combined

    if not os.getenv("GOOGLE_PLACES_API_KEY") and not os.getenv("EVENTBRITE_API_KEY"):
        logger.info("No external API keys configured; returning cached demo data.")
        return [
            {
                "title": "Sunset Kayak Meetup",
                "vibe": "adventure",
                "price": "$",
                "address": "Charles River Canoe & Kayak, Cambridge",
                "lat": 42.372,
                "lng": -71.118,
                "distance_km": 2.4,
                "booking_url": "https://paddleboston.com/events",
                "maps_url": "https://www.google.com/maps/search/?api=1&query=42.372,-71.118",
                "summary": "Paddle the Charles at golden hour with local guides and sunset tunes.",
                "source": "cached",
                "tags": ["sunset", "outdoors", "group"],
            },
            {
                "title": "Indie Film + Tea Night",
                "vibe": "mindful",
                "price": "$",
                "address": "Somerville Theatre Microcinema",
                "lat": 42.381,
                "lng": -71.100,
                "distance_km": 4.1,
                "booking_url": "https://somervilletheatre.com",
                "maps_url": "https://www.google.com/maps/search/?api=1&query=42.381,-71.100",
                "summary": "Cozy screening of indie shorts followed by tea tasting in the lobby.",
                "source": "cached",
                "tags": ["indie", "indoor", "cozy"],
            },
        ]

    return []

# === Inspired extensions (stubs for agentic flow) ===

@lru_cache(maxsize=512)
def tool_get_user_taste_cached(user_id: str) -> UserTaste:
    """
    Lightweight in-process cache for user tastes.
    Replace with Supabase row fetch + HTTP cache headers.
    """
    return tool_get_user_taste(user_id)


def tool_search_places_grid(query: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Grid-style expansion for dense urban discovery.
    For demo: call the same finder, but tag results to indicate grid search.
    """
    base = tool_find_activities(query)
    for r in base:
        r.setdefault("tags", [])
        if "grid" not in r["tags"]:
            r["tags"].append("grid")
    return base


def tool_sentiment_enrich(candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Stub sentiment enrichment. In production, aggregate reviews/social posts and
    attach sentiment facets. Here we just add a neutral sentiment flag.
    """
    enriched: List[Dict[str, Any]] = []
    for c in candidates:
        item = dict(c)
        item["sentiment"] = {"overall": "neutral", "confidence": 0.6}
        enriched.append(item)
    return enriched


def tool_calendar_probe(user_ids: List[str], time_window: Optional[str]) -> Dict[str, Any]:
    """
    Stub calendar probe. In production, query Google Calendar/Outlook with OAuth.
    """
    return {"availability": "unknown", "users": user_ids, "time_window": time_window}


def tool_reserve_table(candidate: Dict[str, Any]) -> Dict[str, Any]:
    """
    Stub reservation hook. In production, integrate with OpenTable/inline or call venue.
    """
    return {"reservation_supported": False, "booking_url": candidate.get("booking_url")}
