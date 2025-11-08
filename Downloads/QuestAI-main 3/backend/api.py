"""
FastAPI service exposing Vivi's agentic planning pipeline.

Run locally:
    uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from .orchestrator import plan
from .schemas import GroupRequest, PlanResponse, UserProfileIn, VisitIn, ProgressResponse, UserTaste
from typing import Optional, List, Dict, Any, Set
from collections import defaultdict
from .tools import _fetch_eventbrite_events, tool_get_user_taste
from .geo import atlanta_hexes, latlng_to_h3

app = FastAPI(title="Vivi Planner API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === In-memory demo storage (no SQL) ===
INMEM_PROFILES: Dict[str, Dict[str, Any]] = {}
INMEM_VISITS: List[Dict[str, Any]] = []
INMEM_USER_HEXES: Dict[str, Set[str]] = defaultdict(set)


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


@app.post("/api/v1/users", status_code=204)
def upsert_user(profile: UserProfileIn) -> None:
    """
    Create or update a user profile/taste in memory.
    """
    INMEM_PROFILES[profile.user_id] = {
        "user_id": profile.user_id,
        "name": profile.name,
        "avatar_url": profile.avatar_url,
        "likes": list(profile.likes or []),
        "dislikes": list(profile.dislikes or []),
        "vibes": list(profile.vibes or []),
        "budget_max": profile.budget_max,
        "distance_km_max": profile.distance_km_max,
        "tags": list(profile.tags or []),
    }


@app.get("/api/v1/users/{user_id}", response_model=UserTaste)
def get_user(user_id: str) -> UserTaste:
    """
    Fetch a user's taste profile. Falls back to tool mock if not set.
    """
    row = INMEM_PROFILES.get(user_id)
    if row:
        return UserTaste(
            user_id=row["user_id"],
            likes=row.get("likes", []),
            dislikes=row.get("dislikes", []),
            vibes=row.get("vibes", []),
            budget_max=row.get("budget_max"),
            distance_km_max=row.get("distance_km_max"),
            tags=row.get("tags", []),
        )
    # Fallback to the development mock taste
    return tool_get_user_taste(user_id)


@app.post("/api/v1/visits")
def create_visit(visit: VisitIn) -> Dict[str, Any]:
    """
    Record a completed visit with optional review and rating (in memory).
    """
    resolution = 9
    h3_index = latlng_to_h3(visit.lat, visit.lng, resolution)
    visit_id = len(INMEM_VISITS) + 1
    payload = {
        "id": visit_id,
        "user_id": visit.user_id,
        "group_id": visit.group_id,
        "place_id": visit.place_id,
        "title": visit.title,
        "address": visit.address,
        "lat": visit.lat,
        "lng": visit.lng,
        "h3": h3_index,
        "rating": visit.rating,
        "review": visit.review,
        "completed_at": visit.completed_at,
    }
    INMEM_VISITS.append(payload)
    INMEM_USER_HEXES[visit.user_id].add(h3_index)
    return {"id": visit_id, "h3": h3_index, "resolution": resolution}


@app.get("/api/v1/visits")
def list_recent_visits(user_id: Optional[List[str]] = Query(default=None)) -> List[Dict[str, Any]]:
    """
    List recent visits, optionally filtered by one or more user_id (from memory).
    """
    items = INMEM_VISITS[-200:]  # latest
    if user_id:
        uid_set = set(user_id)
        items = [v for v in items if v.get("user_id") in uid_set]
    # Return newest first
    return list(reversed(items))


@app.get("/api/v1/progress", response_model=ProgressResponse)
def get_progress(user_id: List[str] = Query(...), resolution: int = 9) -> ProgressResponse:
    """
    Return % explored for Atlanta, GA based on unique visited hexes at the given resolution.
    """
    all_hexes = set(atlanta_hexes(resolution))
    visited: Set[str] = set()
    for uid in user_id:
        visited |= INMEM_USER_HEXES.get(uid, set())
    # Intersect for safety if any stray hexes exist
    visited_in_bounds = visited.intersection(all_hexes)
    total = len(all_hexes) if all_hexes else 1
    pct = (len(visited_in_bounds) / total) * 100.0
    # Center of Atlanta
    center_lat, center_lng = 33.7490, -84.3880
    return ProgressResponse(
        resolution=resolution,
        center_lat=center_lat,
        center_lng=center_lng,
        total_hexes=len(all_hexes),
        visited_hexes=len(visited_in_bounds),
        percent_explored=round(pct, 2),
    )

