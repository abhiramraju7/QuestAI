# Dual-mode import shim: works as module (-m backend.demo_orchestrator)
# and as a direct script (python backend/demo_orchestrator.py)
if __package__ is None or __package__ == "":
    import sys, pathlib
    sys.path.append(str(pathlib.Path(__file__).resolve().parents[1]))
    from backend.schemas import GroupRequest
    from backend.orchestrator import plan
else:
    from .schemas import GroupRequest
    from .orchestrator import plan

def _run():
    req = GroupRequest(
        query_text="we're bored but want something outdoorsy with live music near Cambridge after 5pm, under twenty bucks",
        user_ids=["u1","u2","u3"],
        location_hint="Cambridge, MA",
        time_window="today 5-8pm",
        custom_tags=["live music","outdoors"],
        custom_likes=["jazz picnic"],
        vibe_hint="music",
    )
    resp = plan(req)
    print("ACTION LOG:", " | ".join(resp.action_log))
    for i, c in enumerate(resp.candidates, 1):
        print(f"\n#{i} {c.title} ({c.vibe}) score={c.group_score:.2f}")
        print(f"  {c.price} • {c.address} • {c.distance_km} km")
        for r in c.reasons:
            print("  -", r)

if __name__ == "__main__":
    _run()
