from typing import Any, Dict, List, Optional, Tuple
import os

from .schemas import GroupRequest, PlanResponse, PlanCard
from .agents import ListenerAgent, WriterAgent, llm_json
from .tools import (
    tool_get_user_taste,
    tool_merge_tastes,
    tool_find_activities,
    tool_get_user_taste_cached,
    tool_search_places_grid,
    tool_sentiment_enrich,
    tool_calendar_probe,
    tool_reserve_table,
)
from .prompts import SYSTEM_CONTROLLER


class AgenticController:
    def __init__(self) -> None:
        self.listener = ListenerAgent()
        self.writer = WriterAgent()

    def _apply_request_overrides(
        self,
        merged: Dict[str, Any],
        state: Dict[str, Any],
        controller_overrides: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        merged = dict(merged)
        overrides = controller_overrides or {}
        listener = state.get("listener") or {}

        merged["location"] = overrides.get("location") or state.get("location")
        merged["time_window"] = overrides.get("time_window") or state.get("time_window") or listener.get("time_hint")

        budget_cap_override = state.get("budget_cap_override")
        if budget_cap_override is not None:
            merged["budget_cap"] = budget_cap_override
        distance_override = state.get("distance_override")
        if distance_override is not None:
            merged["distance_cap"] = distance_override

        likes_extra: List[str] = []
        if state.get("custom_likes"):
            likes_extra.extend(state["custom_likes"])
        if overrides.get("likes"):
            likes_extra.extend(overrides["likes"])
        if likes_extra:
            merged["likes"] = list({*merged.get("likes", []), *likes_extra})

        tags_extra: List[str] = []
        if state.get("custom_tags"):
            tags_extra.extend(state["custom_tags"])
        if overrides.get("tags"):
            tags_extra.extend(overrides["tags"])
        if tags_extra:
            merged["tags"] = list({*merged.get("tags", []), *tags_extra})

        merged["vibe"] = (
            overrides.get("vibe")
            or state.get("vibe_hint")
            or (listener.get("primary_vibes") or [merged.get("merged_vibe", "chill")])[0]
        )
        merged["energy_level"] = overrides.get("energy_level") or listener.get("energy_level", "medium")

        return merged

    def _decide(self, state: Dict[str, Any]) -> Dict[str, Any]:
        # Ask LLM controller which tool to call next
        prompt = {
            "query": state.get("query"),
            "listener": state.get("listener"),
            "tastes": [t.model_dump() if hasattr(t, "model_dump") else dict(t) for t in state.get("tastes", [])],
            "merged": state.get("merged"),
            "observations": state.get("observations", []),
        }
        return llm_json(
            prompt=str(prompt),
            system=SYSTEM_CONTROLLER,
        ) or {}

    def run(self, req: GroupRequest) -> PlanResponse:
        action_log: List[str] = []

        # Seed with listener intent to keep controller lightweight
        listener_out = self.listener.run(req.query_text)
        action_log.append("Listener: parsed vibes/time/budget")

        state: Dict[str, Any] = {
            "query": req.query_text.strip(),
            "user_ids": req.user_ids,
            "location": (req.location_hint or "Boston, MA").strip(),
            "time_window": (req.time_window or "").strip() or None,
            "listener": listener_out,
            "tastes": [],
            "merged": None,
            "raw_candidates": [],
            "observations": [],
            "custom_likes": req.custom_likes,
            "custom_tags": req.custom_tags,
            "budget_cap_override": req.budget_cap,
            "distance_override": req.distance_km,
            "vibe_hint": req.vibe_hint,
        }

        # Default deterministic path if controller cannot produce actions
        default_plan: Optional[PlanResponse] = None

        for step in range(1, 8):
            decision = self._decide(state)
            action = decision.get("action")
            args = decision.get("args") or {}
            rationale = decision.get("rationale") or ""

            if not action:
                # Build a default path once; if LLM is disabled or fails
                if default_plan is None:
                    # Fallback: get tastes → merge → search → write
                    tastes = [tool_get_user_taste(uid) for uid in req.user_ids]
                    merged = tool_merge_tastes(tastes)
                    merged = self._apply_request_overrides(merged, state)
                    raw = tool_find_activities(merged)
                    cards = self.writer.run({"merged": merged, "raw_candidates": raw})
                    default_plan = PlanResponse(
                        query_normalized=state["query"],
                        merged_vibe=merged.get("vibe", "chill"),
                        energy_profile=merged.get("energy_level", "medium"),
                        candidates=cards,
                        action_log=action_log + [
                            "Planner: merged tastes & fetched activities (fallback)",
                            f"Writer: scored {len(cards)} candidates",
                        ],
                    )
                return default_plan

            if action == "get_tastes":
                user_ids = args.get("user_ids") or state["user_ids"]
                tastes = [tool_get_user_taste_cached(uid) for uid in user_ids]
                state["tastes"] = tastes
                obs = f"Fetched tastes for {len(tastes)} users"
                state["observations"].append(obs)
                action_log.append("Controller:get_tastes")
                continue

            if action == "merge_tastes":
                if not state["tastes"]:
                    # Ensure precondition
                    tastes = [tool_get_user_taste(uid) for uid in state["user_ids"]]
                    state["tastes"] = tastes
                merged = tool_merge_tastes(state["tastes"])
                overrides = (args.get("overrides") or {})
                merged = self._apply_request_overrides(merged, state, overrides)
                state["merged"] = merged
                obs = f"Merged tastes → vibe={merged.get('vibe')} budget_cap={merged.get('budget_cap')}"
                state["observations"].append(obs)
                action_log.append("Controller:merge_tastes")
                continue

            if action == "find_activities":
                if not state.get("merged"):
                    # Merge if not done
                    merged = tool_merge_tastes(state["tastes"])
                    merged = self._apply_request_overrides(merged, state)
                    state["merged"] = merged
                raw = tool_find_activities(state["merged"])
                state["raw_candidates"] = raw
                obs = f"Found {len(raw)} activities"
                state["observations"].append(obs)
                action_log.append("Controller:find_activities")
                continue

            if action == "search_places_grid":
                merged = state.get("merged")
                if not merged:
                    # ensure merged exists
                    if not state["tastes"]:
                        state["tastes"] = [tool_get_user_taste_cached(uid) for uid in state["user_ids"]]
                    merged = tool_merge_tastes(state["tastes"])
                merged = self._apply_request_overrides(merged, state)
                state["merged"] = merged
                grid = tool_search_places_grid(merged)
                # prefer union with prior candidates
                prev = state.get("raw_candidates") or []
                state["raw_candidates"] = (prev or []) + grid
                obs = f"Grid search yielded {len(grid)} candidates"
                state["observations"].append(obs)
                action_log.append("Controller:search_places_grid")
                continue

            if action == "enrich_sentiment":
                prev = state.get("raw_candidates") or []
                enriched = tool_sentiment_enrich(prev)
                state["raw_candidates"] = enriched
                obs = "Enriched candidates with sentiment"
                state["observations"].append(obs)
                action_log.append("Controller:enrich_sentiment")
                continue

            if action == "probe_calendar":
                cal = tool_calendar_probe(state["user_ids"], state.get("time_window"))
                state["observations"].append(f"Calendar probe: {cal.get('availability')}")
                action_log.append("Controller:probe_calendar")
                continue

            if action == "reserve":
                idx = args.get("index", 0)
                pool = state.get("raw_candidates") or []
                if pool and 0 <= idx < len(pool):
                    res = tool_reserve_table(pool[idx])
                    state["observations"].append(f"Reservation: {res.get('reservation_supported')}")
                action_log.append("Controller:reserve")
                continue

            if action == "finalize":
                merged = state.get("merged") or {}
                p_out = {"merged": merged, "raw_candidates": state.get("raw_candidates", [])}
                cards = self.writer.run(p_out)
                action_log.append(f"Writer: scored {len(cards)} candidates")
                return PlanResponse(
                    query_normalized=state["query"],
                    merged_vibe=merged.get("vibe", "chill"),
                    energy_profile=merged.get("energy_level", "medium"),
                    candidates=cards,
                    action_log=action_log,
                )

            # Safety: if an unknown action is returned, break to fallback
            break

        # If loop exits without finalize, return fallback
        merged = state.get("merged") or {}
        p_out = {"merged": merged, "raw_candidates": state.get("raw_candidates", [])}
        cards = self.writer.run(p_out)
        action_log.append(f"Writer: scored {len(cards)} candidates (loop-exit)")
        return PlanResponse(
            query_normalized=state["query"],
            merged_vibe=merged.get("vibe", "chill") if merged else "chill",
            energy_profile=merged.get("energy_level", "medium") if merged else "medium",
            candidates=cards,
            action_log=action_log,
        )


def agentic_plan(req: GroupRequest) -> PlanResponse:
    return AgenticController().run(req)


