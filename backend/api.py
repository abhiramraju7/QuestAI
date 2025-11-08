"""
FastAPI service exposing Vivi's agentic planning pipeline.

Run locally:
    uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .orchestrator import plan
from .schemas import GroupRequest, PlanResponse
from typing import Optional, List, Dict, Any
from .tools import _fetch_eventbrite_events

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

@app.get("/api/v1/events")
def list_events(
    location: Optional[str] = None,
    vibe: Optional[str] = None,
    time_window: Optional[str] = None,
    distance_km: Optional[int] = 10,
) -> List[Dict[str, Any]]:
    """
    Direct Eventbrite search using EVENTBRITE_API_KEY.
    Usage example:
      GET /api/v1/events?location=Cambridge,MA&vibe=music&time_window=today%205-9pm&distance_km=10
    """
    query: Dict[str, Any] = {
        "location": location,
        "vibe": vibe or "activities",
        "time_window": time_window,
        "distance_cap": distance_km,
    }
    return _fetch_eventbrite_events(query)


