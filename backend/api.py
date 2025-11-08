"""
FastAPI service exposing Vivi's agentic planning pipeline.

Run locally:
    uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .orchestrator import plan
from .schemas import GroupRequest, PlanResponse, FeedbackRequest, VisitRequest, VisitItem, ProgressResponse
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

@app.post("/api/v1/feedback")
def feedback(req: FeedbackRequest) -> dict:
    """
    Lightweight mood reaction sink. For demo, we just log and return ok.
    """
    # In production, persist to taste graph
    print("FEEDBACK:", req.model_dump())
    return {"ok": True}

# === Simple in-memory visit/progress store for demo ===
VISITS: list[VisitItem] = []
VISITED_CELLS: set[str] = set()

def _cell_key(lat: float, lng: float, step: float = 0.01) -> str:
    from math import floor
    return f"{floor(lat/step)}:{floor(lng/step)}"

def _atl_bbox():
    # Rough bounding box for Atlanta urban core
    return (33.60, -84.55, 33.90, -84.20)  # south, west, north, east

@app.post("/api/v1/visit")
def visit(req: VisitRequest) -> dict:
    item = VisitItem(title=req.title, lat=req.lat, lng=req.lng, user_ids=req.user_ids)
    VISITS.append(item)
    VISITED_CELLS.add(_cell_key(req.lat, req.lng))
    return {"ok": True, "count": len(VISITS)}

@app.get("/api/v1/visited")
def visited() -> list[VisitItem]:
    return VISITS

@app.get("/api/v1/progress", response_model=ProgressResponse)
def progress() -> ProgressResponse:
    south, west, north, east = _atl_bbox()
    step = 0.01
    total_lat = int((north - south) / step)
    total_lng = int((east - west) / step)
    total_cells = max(1, total_lat * total_lng)
    visited_cells = len(VISITED_CELLS)
    percent = min(1.0, visited_cells / total_cells)
    return ProgressResponse(
        percent_explored=round(percent, 4),
        visited_cells=visited_cells,
        total_cells=total_cells,
    )
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


