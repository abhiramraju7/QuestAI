"""
Offline fallbacks for Google Places and Eventbrite lookups.

When the API keys are missing in local or demo environments we still want the
map + planner to feel alive.  These helpers surface a curated Cambridge data
set and lightly score / filter results against the incoming query so the rest
of the pipeline receives realistic documents.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Tuple

# Rough price band ordering to keep the scoring logic human-readable.
_PRICE_LEVELS = {
    "free": 0,
    "$": 1,
    "$$": 2,
    "$$$": 3,
    "$$$$": 4,
}


def _price_to_level(value: Optional[str]) -> Optional[int]:
    if not value:
        return None
    normalized = value.strip().lower()
    return _PRICE_LEVELS.get(normalized)


def _lc_words(items: Iterable[str]) -> List[str]:
    return [item.strip().lower() for item in items if item]


_MOCK_EVENTS: Dict[str, List[Dict[str, Any]]] = {
    "google_places": [
        {
            "id": "gp-charles-river-espl",
            "title": "Charles River Esplanade",
            "vibe": "outdoors",
            "price": "free",
            "address": "Storrow Dr, Boston, MA 02114",
            "lat": 42.3554,
            "lng": -71.0721,
            "distance_km": 1.2,
            "booking_url": None,
            "maps_url": "https://maps.google.com/?q=Charles+River+Esplanade",
            "source": "google_places",
            "tags": ["park", "scenic", "running", "cycling"],
            "summary": "Riverfront greenway with sunset views, perfect for picnics and casual walks.",
        },
        {
            "id": "gp-aeronaut-brewing",
            "title": "Aeronaut Brewing Co.",
            "vibe": "social",
            "price": "$$",
            "address": "14 Tyler St, Somerville, MA 02143",
            "lat": 42.3807,
            "lng": -71.0989,
            "distance_km": 2.4,
            "booking_url": "https://www.aeronautbrewing.com/",
            "maps_url": "https://maps.google.com/?q=Aeronaut+Brewing+Co",
            "source": "google_places",
            "tags": ["brewery", "live music", "nightlife"],
            "summary": "Community-oriented taproom with rotating events, trivia, and live sets.",
        },
        {
            "id": "gp-bow-market",
            "title": "Bow Market",
            "vibe": "creative",
            "price": "$",
            "address": "1 Bow Market Way, Somerville, MA 02143",
            "lat": 42.3797,
            "lng": -71.0966,
            "distance_km": 2.1,
            "booking_url": "https://www.bowmarketsomerville.com/",
            "maps_url": "https://maps.google.com/?q=Bow+Market",
            "source": "google_places",
            "tags": ["market", "artisanal", "food hall"],
            "summary": "Open-air courtyard of indie food stalls, makers, and pop-up performances.",
        },
        {
            "id": "gp-the-sinclair",
            "title": "The Sinclair",
            "vibe": "music",
            "price": "$$",
            "address": "52 Church St, Cambridge, MA 02138",
            "lat": 42.3736,
            "lng": -71.1202,
            "distance_km": 0.6,
            "booking_url": "https://www.sinclaircambridge.com/",
            "maps_url": "https://maps.google.com/?q=The+Sinclair",
            "source": "google_places",
            "tags": ["concert venue", "nightlife", "indie"],
            "summary": "Intimate Harvard Square venue hosting touring bands and themed DJ nights.",
        },
        {
            "id": "gp-nightshift-lovejoy",
            "title": "Nightshift Brewing Lovejoy Wharf",
            "vibe": "social",
            "price": "$$",
            "address": "1 Lovejoy Wharf, Boston, MA 02114",
            "lat": 42.3675,
            "lng": -71.0604,
            "distance_km": 2.7,
            "booking_url": "https://www.nightshiftbrewing.com/locations/lovejoy-wharf/",
            "maps_url": "https://maps.google.com/?q=Nightshift+Brewing+Lovejoy+Wharf",
            "source": "google_places",
            "tags": ["brewery", "harbor", "patio"],
            "summary": "Large taproom on the Boston Harbor with board games and frequent pop-up events.",
        },
    ],
    "eventbrite": [
        {
            "id": "eb-sunset-kayak",
            "title": "Sunset Kayak Social on the Charles",
            "vibe": "outdoors",
            "price": "$$",
            "address": "Charles River Canoe & Kayak, Cambridge, MA",
            "lat": 42.3621,
            "lng": -71.1132,
            "distance_km": 1.8,
            "booking_url": "https://www.eventbrite.com/e/sunset-kayak-social-tickets-123456789",
            "maps_url": "https://maps.google.com/?q=Charles+River+Canoe+%26+Kayak",
            "source": "eventbrite",
            "tags": ["kayaking", "sunset", "fitness"],
            "summary": "Group paddle with instructors, capped with snacks on the dock.",
        },
        {
            "id": "eb-vinyl-night",
            "title": "Vinyl Night at Lamplighter Brewing",
            "vibe": "music",
            "price": "$",
            "address": "Lamplighter Brewing Co., Cambridge, MA",
            "lat": 42.3649,
            "lng": -71.1016,
            "distance_km": 1.1,
            "booking_url": "https://www.eventbrite.com/e/vinyl-night-at-lamplighter-tickets-234567891",
            "maps_url": "https://maps.google.com/?q=Lamplighter+Brewing+Co",
            "source": "eventbrite",
            "tags": ["vinyl", "craft beer", "nightlife"],
            "summary": "Bring your records, trade picks with the DJ, and enjoy small-batch pours.",
        },
        {
            "id": "eb-pop-up-market",
            "title": "Central Square Night Market",
            "vibe": "creative",
            "price": "free",
            "address": "Central Square, Cambridge, MA",
            "lat": 42.3654,
            "lng": -71.1037,
            "distance_km": 0.8,
            "booking_url": "https://www.eventbrite.com/e/central-square-night-market-tickets-345678912",
            "maps_url": "https://maps.google.com/?q=Central+Square+Cambridge",
            "source": "eventbrite",
            "tags": ["market", "art", "food trucks"],
            "summary": "Monthly open-air bazaar with live DJs, street food, and local makers.",
        },
        {
            "id": "eb-board-game-cafe",
            "title": "Board Game Meetup at Knight Moves",
            "vibe": "cozy",
            "price": "$",
            "address": "Knight Moves Cafe, Brookline, MA",
            "lat": 42.3419,
            "lng": -71.1219,
            "distance_km": 4.7,
            "booking_url": "https://www.eventbrite.com/e/board-game-meetup-tickets-456789123",
            "maps_url": "https://maps.google.com/?q=Knight+Moves+Cafe",
            "source": "eventbrite",
            "tags": ["board games", "cafe", "social"],
            "summary": "Reserve a table and dive into strategy classics with other gamers.",
        },
        {
            "id": "eb-silent-disco",
            "title": "Rooftop Silent Disco",
            "vibe": "party",
            "price": "$$",
            "address": "Envoy Hotel Rooftop, Boston, MA",
            "lat": 42.3525,
            "lng": -71.0436,
            "distance_km": 3.5,
            "booking_url": "https://www.eventbrite.com/e/rooftop-silent-disco-tickets-567891234",
            "maps_url": "https://maps.google.com/?q=Envoy+Hotel+Rooftop",
            "source": "eventbrite",
            "tags": ["dance", "nightlife", "skyline"],
            "summary": "Choose your channel and dance the night away above the Seaport skyline.",
        },
    ],
}


def _budget_to_level(budget_cap: float) -> int:
    if budget_cap <= 0:
        return 0
    if budget_cap <= 20:
        return 1
    if budget_cap <= 45:
        return 2
    if budget_cap <= 75:
        return 3
    return 4


def _event_score(event: Dict[str, Any], query: Dict[str, Any]) -> float:
    """Lightweight heuristic scoring to keep results in a sensible order."""
    score = 0.0

    vibe_query = (query.get("vibe") or "").strip().lower()
    if vibe_query and event.get("vibe", "").lower() == vibe_query:
        score += 2.5
    elif vibe_query and vibe_query in _lc_words(event.get("tags", [])):
        score += 1.5

    likes = set(_lc_words(query.get("likes", [])))
    tags = set(_lc_words(query.get("tags", [])))
    if likes:
        overlap = likes.intersection(_lc_words(event.get("tags", [])))
        score += len(overlap) * 1.2
    if tags:
        overlap = tags.intersection(_lc_words(event.get("tags", [])))
        score += len(overlap)

    budget_cap = query.get("budget_cap")
    if budget_cap is not None:
        level = _price_to_level(event.get("price"))
        if level is not None:
            if level <= _budget_to_level(float(budget_cap)):
                score += 1.0
            else:
                score -= 1.0

    return score


def get_tool_candidates(provider: str, query: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return fallback events shaped like live API responses."""

    events = _MOCK_EVENTS.get(provider, [])
    if not events:
        return []

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for event in events:
        score = _event_score(event, query)
        scored.append((score, event))

    scored.sort(key=lambda item: item[0], reverse=True)
    return [dict(event) for _, event in scored[:20]]


def search_mock_events(filters: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Merge and lightly filter results from both mock providers.
    Expected filters keys:
      - q, location, vibe, provider, likes, tags, limit, time_window, distance_cap
    """
    provider = (filters.get("provider") or "").strip().lower()
    providers: List[str] = (
        [provider] if provider in _MOCK_EVENTS.keys() else list(_MOCK_EVENTS.keys())
    )

    merged: List[Dict[str, Any]] = []
    for p in providers:
        merged.extend(get_tool_candidates(p, filters))

    # Text and facet filters
    q = (filters.get("q") or "").strip().lower()
    vibe = (filters.get("vibe") or "").strip().lower()

    def _match(event: Dict[str, Any]) -> bool:
        if vibe and (event.get("vibe", "") or "").lower() != vibe:
            return False
        if q:
            hay = " ".join(
                [
                    str(event.get("title", "")),
                    str(event.get("summary", "")),
                    str(event.get("address", "")),
                ]
            ).lower()
            if q not in hay:
                return False
        return True

    filtered = [e for e in merged if _match(e)]

    # Re-score across providers so top items rise to the top.
    rescored: List[Tuple[float, Dict[str, Any]]] = [
        (_event_score(e, filters), e) for e in filtered
    ]
    rescored.sort(key=lambda item: item[0], reverse=True)

    limit = int(filters.get("limit") or 25)
    return [dict(e) for _, e in rescored[:limit]]
