"""
FastAPI service exposing Vivi's agentic planning pipeline.

Run locally:
    uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .orchestrator import plan
from .schemas import GroupRequest, PlanResponse, EventItem
from typing import Optional, List, Dict, Any
from .mock_events import search_mock_events
from .tools import tool_find_activities

app = FastAPI(title="Vivi Planner API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck() -> dict:
    return {"status": "ok", "service": "vivi-planner"}


@app.post("/api/v1/plan", response_model=PlanResponse)
def create_plan(req: GroupRequest) -> PlanResponse:
    """
    Execute the listener → planner → writer pipeline and return ranked plan cards.
    """
    return plan(req)


@app.get("/api/v1/events", response_model=List[EventItem])
def list_events(
    q: Optional[str] = Query(None, description="Keyword search across title, summary, venue."),
    location: Optional[str] = Query(None, description="City, neighborhood, or address filter."),
    vibe: Optional[str] = Query(None, description="Vibe keyword such as music, outdoors, cozy."),
    provider: Optional[str] = Query(
        None,
        description="Filter by provider alias (eventbrite, google_places).",
        regex="^(eventbrite|google_places)$",
    ),
    limit: int = Query(25, ge=1, le=100),
    time_window: Optional[str] = Query(None, description="Optional timeframe context."),
    distance_km: Optional[int] = Query(10, ge=1, le=100),
    likes: Optional[str] = Query(
        None, description="Comma-separated likes to boost relevance (e.g. live music, sunset)."
    ),
    tags: Optional[str] = Query(
        None, description="Comma-separated tags/constraints (e.g. outdoor, free)."
    ),
) -> List[EventItem]:
    """
    Search activities/events from providers and return lightweight items.
    Uses real Google Places/Eventbrite if API keys are configured, otherwise falls back to mocks.
    """

    def _split_csv(value: Optional[str]) -> List[str]:
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]

    filters: Dict[str, Any] = {
        "q": q,
        "location": location,
        "vibe": vibe,
        "provider": provider,
        "limit": limit,
        "time_window": time_window,
        "distance_cap": distance_km,
        "likes": _split_csv(likes),
        "tags": _split_csv(tags),
    }

    # Prefer real providers if configured
    items: List[Dict[str, Any]] = tool_find_activities(filters)
    if not items:
        items = search_mock_events(filters)

    def _mk_id(it: Dict[str, Any]) -> str:
        base = f"{it.get('source','src')}::{it.get('title','')}::{it.get('address','')}"
        return str(abs(hash(base)))

    normalized: List[EventItem] = []
    for it in items[:limit]:
        payload: Dict[str, Any] = {
            "id": it.get("id") or _mk_id(it),
            "title": it.get("title"),
            "venue": it.get("venue"),
            "address": it.get("address"),
            "image_url": it.get("image_url"),
            "lat": it.get("lat"),
            "lng": it.get("lng"),
            "price": it.get("price"),
            "vibe": it.get("vibe"),
            "summary": it.get("summary"),
            "booking_url": it.get("booking_url"),
            "maps_url": it.get("maps_url"),
            "source": it.get("source") or "unknown",
        }
        normalized.append(EventItem(**payload))
    return normalized


