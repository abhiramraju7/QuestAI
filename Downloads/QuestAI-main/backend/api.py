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
    Search the mock catalog representing Eventbrite + Google Places results.
    Swap `search_mock_events` for real provider integrations once API keys are wired.
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

    results = search_mock_events(filters)
    return [EventItem(**item) for item in results]


