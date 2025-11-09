from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .mock_events import search_mock_events
from .schemas import (
    ActivitySearchRequest,
    AgentDiscoverRequest,
    AgentDiscoverResponse,
    EventItem,
)
from .tools import tool_find_activities
from .agent_workflow import agent_discover

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


@app.post("/api/v1/agent/discover", response_model=AgentDiscoverResponse)
def agent_discover_endpoint(req: AgentDiscoverRequest) -> AgentDiscoverResponse:
    if not req.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    result = agent_discover(req.prompt, req.location, req.budget_cap, req.friends)

    activities = [
        EventItem(**item)
        for item in result.get("activities", [])[:25]
        if item.get("title")
    ]

    return AgentDiscoverResponse(
        summary=result.get("summary") or "",
        keywords=result.get("keywords") or [],
        activities=activities,
    )


@app.post("/api/v1/activities", response_model=List[EventItem])
def search_activities(req: ActivitySearchRequest) -> List[EventItem]:
    """
    Minimal activity search. Uses Eventbrite and Google Places if API keys are configured,
    otherwise falls back to the bundled Cambridge demo data.
    """

    def _extract_terms(text: str) -> List[str]:
        terms: List[str] = []
        seen: set[str] = set()
        for chunk in text.replace("•", ",").split(","):
            for word in chunk.strip().split():
                token = "".join(ch for ch in word.lower() if ch.isalnum())
                if len(token) < 3:
                    continue
                if token not in seen:
                    seen.add(token)
                    terms.append(token)
        return terms

    filters: Dict[str, Any] = {
        "q": req.query_text,
        "location": req.location,
        "budget_cap": req.budget_cap,
        "likes": _extract_terms(req.query_text),
        "tags": [],
        "distance_cap": 10,
    }

    items: List[Dict[str, Any]] = tool_find_activities(filters)
    if not items:
        items = search_mock_events(filters)

    def _mk_id(it: Dict[str, Any]) -> str:
        base = f"{it.get('source','src')}::{it.get('title','')}::{it.get('address','')}"
        return str(abs(hash(base)))

    normalized: List[EventItem] = []
    for it in items[:25]:
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
