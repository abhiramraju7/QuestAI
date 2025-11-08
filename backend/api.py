"""
FastAPI service exposing Vivi's agentic planning pipeline.

Run locally:
    uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .orchestrator import plan
from .schemas import GroupRequest, PlanResponse, PlanCard
from typing import Optional, List, Dict, Any
from .tools import _fetch_eventbrite_events, tool_get_user_taste, tool_merge_tastes, tool_find_activities
from .agents import WriterAgent

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

@app.get("/api/v1/dashboard")
def dashboard(
    location: Optional[str] = "Cambridge, MA",
    vibe: Optional[str] = None,
    time_window: Optional[str] = "today 5-9pm",
    user_ids: Optional[str] = "u1,u2,u3",
) -> Dict[str, Any]:
    """
    Aggregated dashboard for social interactions:
    - Top picks (agent writer over merged tastes + discovery)
    - Trending events (Eventbrite)
    - Vibe stats from group tastes
    """
    # tastes and merge
    ids = [uid.strip() for uid in (user_ids or "").split(",") if uid.strip()]
    tastes = [tool_get_user_taste(uid) for uid in ids]
    merged = tool_merge_tastes(tastes)
    merged["location"] = location
    merged["time_window"] = time_window
    if vibe:
        merged["vibe"] = vibe
    else:
        merged["vibe"] = merged.get("merged_vibe", "social")
    merged.setdefault("energy_level", "medium")

    # discovery + writer
    raw = tool_find_activities(merged)
    writer = WriterAgent()
    top_cards: List[PlanCard] = writer.run({"merged": merged, "raw_candidates": raw})

    # trending events
    events = _fetch_eventbrite_events({
        "location": location,
        "vibe": merged["vibe"],
        "time_window": time_window,
        "distance_cap": merged.get("distance_cap", 10),
    })

    # vibe stats
    from collections import Counter
    vibe_counts = Counter(v for t in tastes for v in t.vibes)
    vibe_stats = [{"vibe": v, "count": c} for v, c in vibe_counts.most_common()]

    return {
        "top_picks": [c.model_dump() for c in top_cards],
        "trending_events": events[:12],
        "vibe_stats": vibe_stats,
        "meta": {
            "location": location,
            "vibe": merged["vibe"],
            "time_window": time_window,
            "users": ids,
        },
    }


