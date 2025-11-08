# backend/agents.py
import json
import os
from typing import List, Dict, Any, Optional
from .prompts import SYSTEM_LISTENER, SYSTEM_PLANNER, SYSTEM_WRITER
from .schemas import UserTaste, PlanCard
from .tools import tool_get_user_taste, tool_merge_tastes, tool_find_activities

def llm_json(prompt: str, system: str) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            import google.generativeai as genai  # type: ignore

            genai.configure(api_key=api_key)
            model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(
                [
                    {
                        "role": "user",
                        "parts": [
                            f"{system.strip()}\n\nUser request:\n{prompt.strip()}\n\nRespond with compact JSON only."
                        ],
                    }
                ],
                generation_config={
                    "temperature": 0.1,
                    "response_mime_type": "application/json",
                },
            )
            text = getattr(response, "text", None)
            if not text and response.candidates:
                text = "".join(
                    part.text or ""
                    for part in response.candidates[0].content.parts
                )
            if text:
                return json.loads(text)
        except Exception:
            # Fall back to deterministic mock response if Gemini fails.
            pass

    # Mock fallback for local development without Gemini access.
    if system == SYSTEM_LISTENER:
        return {
            "primary_vibes": ["outdoors", "music"],
            "budget_hint": "<30",
            "indoor_outdoor": "outdoor",
            "energy_level": "medium",
            "time_hint": "today after 5pm"
        }
    return {}

class ListenerAgent:
    def run(self, query_text: str) -> Dict[str, Any]:
        # In production: call your real LLM with SYSTEM_LISTENER
        return llm_json(prompt=query_text, system=SYSTEM_LISTENER)

class PlannerAgent:
    def run(
        self,
        user_ids: List[str],
        listener_out: Dict[str, Any],
        location_hint: str,
        time_window: Optional[str],
        request_overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        # 1) fetch tastes
        tastes = [tool_get_user_taste(uid) for uid in user_ids]
        # 2) merge constraints and preferences
        merged = tool_merge_tastes(tastes)
        merged["location"] = location_hint
        merged["time_window"] = time_window or listener_out.get("time_hint")
        overrides = request_overrides or {}
        if overrides.get("budget_cap") is not None:
            merged["budget_cap"] = overrides["budget_cap"]
        if overrides.get("distance_km") is not None:
            merged["distance_cap"] = overrides["distance_km"]
        likes_extra = overrides.get("custom_likes") or []
        if likes_extra:
            merged["likes"] = list({*merged.get("likes", []), *likes_extra})
        tags_extra = overrides.get("custom_tags") or []
        if tags_extra:
            merged["tags"] = list({*merged.get("tags", []), *tags_extra})
        # prefer explicit vibe hint, else listener’s top vibe if present; else merged heuristic
        listener_vibes = listener_out.get("primary_vibes") or []
        merged_vibe_default = merged.get("merged_vibe")
        merged["vibe"] = (
            overrides.get("vibe_hint")
            or (listener_vibes[0] if listener_vibes else merged_vibe_default)
        )
        merged["energy_level"] = listener_out.get("energy_level", "medium")
        # 3) search activities
        raw = tool_find_activities(merged)
        return {"tastes": tastes, "merged": merged, "raw_candidates": raw}

class WriterAgent:
    def run(self, planner_out: Dict[str, Any]) -> List[PlanCard]:
        merged = planner_out["merged"]
        cards: List[PlanCard] = []

        for r in planner_out["raw_candidates"]:
            # basic scoring
            score = 0.4
            candidate_vibe = str(r.get("vibe") or merged.get("vibe") or "").lower()
            merged_vibe = str(merged.get("vibe") or "").lower()
            if candidate_vibe and merged_vibe and candidate_vibe == merged_vibe:
                score += 0.3

            price = str(r.get("price", "")).lower()
            budget_cap = merged.get("budget_cap")
            if price == "free" or (price == "$" and (budget_cap is None or budget_cap >= 10)):
                score += 0.2

            # small boost for overlapping tags/likes
            if any(t in (r.get("tags") or []) for t in merged.get("likes", [])):
                score += 0.1

            cards.append(PlanCard(
                title=r["title"],
                subtitle=None,
                time=merged.get("time_window"),
                price=r.get("price"),
                vibe=r.get("vibe") or merged.get("vibe"),
                energy=merged.get("energy_level"),
                address=r.get("address"),
                lat=r.get("lat"),
                lng=r.get("lng"),
                distance_km=r.get("distance_km"),
                booking_url=r.get("booking_url"),
                maps_url=r.get("maps_url"),
                summary=r.get("summary"),
                group_score=min(score, 1.0),
                reasons=[
                    f"Matches vibe: {merged.get('vibe')}",
                    f"Budget OK: {r.get('price')}",
                    f"Energy: {merged.get('energy_level', 'medium')}",
                    f"Distance ≈ {r.get('distance_km')} km"
                ],
                source=r.get("source", "cached")
            ))

        # sort by best fit
        cards.sort(key=lambda c: c.group_score, reverse=True)
        # return top 3–5
        return cards[:5]
