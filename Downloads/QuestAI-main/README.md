# Vivi — Agentic Activity Network

“You bring the mood, and your friends bring the vibe. AI orchestrates the plan.”

Vivi is a full-stack reimagining of the Yumi social-agentic platform, pivoting from food discovery to activity discovery. The system coordinates group moods, taste graphs, and live event data to suggest the perfect shared experience. The repo now targets a Netlify-hosted web app paired with a FastAPI backend you can deploy on your preferred free-tier provider (Railway, Fly.io, Cloud Run, etc.).

---

## Architecture

- **Frontend** — Vite + React web app (`frontend/`) that captures natural language mood prompts, lets you tag friends, and renders AI-curated plan cards.
- **Backend** — FastAPI service (`backend/`) orchestrating multi-agent planning (listener → profile → merge → explorer → writer → scheduler) with pluggable tool functions.
- **Data Contracts** — Typed schemas in `backend/schemas.py`; mock tool implementations ready to be swapped for Supabase, Google Places, Eventbrite, Meetup, TikTok sentiment, etc.
- **Deployment** — `netlify.toml` drives the static build on Netlify. Deploy the FastAPI backend separately (Railway shown below) and point the frontend via `VITE_API_BASE_URL`.

---

## Getting Started

### 1. Backend (FastAPI)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.api:app --host 0.0.0.0 --port 8000
```

> Optional: if you later add embedding/ranking features, install heavier ML libraries (e.g. `sentence-transformers`) manually. They are excluded from `requirements.txt` so Railway’s free tier stays within build limits.

Environment variables (backend):

- `GEMINI_API_KEY` *(optional)* — enables Google Gemini for the listener/writer agents. Without it, the service falls back to deterministic mocks.
- `GEMINI_MODEL` *(optional, default `gemini-1.5-flash`)* — override the Gemini model.
- `GOOGLE_PLACES_API_KEY` — required for live place discovery and geocoding via Google Places.
- `EVENTBRITE_API_KEY` — required for live event discovery via the Eventbrite API (bearer token).
- `USE_AGENTIC` *(optional)* — set to `1` to enable the iterative controller workflow.

**Request payload fields**

```jsonc
{
  "query_text": "Natural language mood prompt",
  "user_ids": ["u1", "u2"],
  "location_hint": "Cambridge, MA",
  "time_window": "today 5-8pm",
  "vibe_hint": "music",
  "budget_cap": 25,
  "distance_km": 5,
  "custom_likes": ["jazz", "sunset picnic"],
  "custom_tags": ["live music", "outdoor"]
}
```

`custom_likes` and `custom_tags` flow into both Google Places and Eventbrite searches, so the backend can reconcile your personal suggestions with your friends’ profiles when assembling plan cards.

Test locally:

```bash
curl -X POST http://localhost:8000/api/v1/plan \
  -H "Content-Type: application/json" \
  -d '{
        "query_text": "We are broke, want outdoor music near Cambridge after 5pm.",
        "user_ids": ["u1","u2","u3"],
        "location_hint": "Cambridge, MA",
        "time_window": "today 5-8pm",
        "custom_tags": ["live music", "outdoor"]
      }'
```

> If either API key is missing, the backend falls back to a tiny Cambridge demo set so you can still exercise the flow locally. For production, set both keys to see live Eventbrite + Google Places results.

### 2. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_BASE_URL=http://localhost:8000` in a `.env.local` file to point at the FastAPI service.

---

## Deploying the Backend (Railway example)

1. Install the Railway CLI and log in: `npm i -g @railway/cli && railway login`.
2. From the repo root run `railway init`, choose “Empty Project,” and follow prompts.
3. Set build/run commands in the Railway dashboard (or `.railway/config.json`):
   - Install: `pip install -r requirements.txt`
   - Start: `uvicorn backend.api:app --host 0.0.0.0 --port 8080`
4. Add environment variables (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_API_KEY`, etc.).
5. Deploy — Railway will expose a public HTTPS URL (note the port defaults to 8080).

Any other container-friendly host (Fly.io, Google Cloud Run, Heroku, DigitalOcean App Platform) can reuse those commands.

## Deploying the Frontend (Netlify)

The included `netlify.toml` configures Netlify to build from the `frontend/` directory.

1. Push this repo to GitHub/GitLab/Bitbucket.
2. In Netlify, click “Add new site” → “Import an existing project.”
3. Choose the repo and branch. Netlify reads `netlify.toml`, so the build command becomes:
   - Base directory: `frontend`
   - Build command: `npm install && npm run build`
   - Publish directory: `dist`
4. Set environment variable `VITE_API_BASE_URL` (under Site settings → Build & deploy → Environment) to the public URL of your backend (e.g. `https://vivi-api-production.up.railway.app`).
5. Deploy. Each push to the selected branch auto-triggers a rebuild.

Optional: remove or adjust the redirect in `netlify.toml` once you know your backend URL.

---

## Extending to Production

- Replace `backend/tools.py` stubs with live integrations (Supabase for profiles, Google Places/Eventbrite/Meetup for activities, TikTok/Reddit scrapers for vibe validation).
- Swap `llm_json` in `backend/agents.py` with calls to Gemini Flash or Claude 3.5 via function calling.
- Add embeddings via `sentence-transformers` to compute merge weights and history-aware recommendations.
- Wire a scheduler agent to auto-create calendar invites or group texts (e.g., via Twilio).
- Expand frontend with authentication, saved crews, and “auto-nudge” predictions (“You and @Rajesh are free Sunday; want a mindful hike?”).

---

## Agentic Mode (ReAct-style tool loop)

This repo includes an actual agentic controller that plans iteratively via tool calls.

- Controller: `backend/agentic.py` (uses a loop: get_tastes → merge_tastes → find_activities → search_places_grid → enrich_sentiment → probe_calendar → reserve → finalize)
- Prompt: `SYSTEM_CONTROLLER` in `backend/prompts.py`
- Enable via environment variable:

```bash
export USE_AGENTIC=1
uvicorn backend.api:app --host 0.0.0.0 --port 8000
```

When `USE_AGENTIC=1`, `backend/orchestrator.py` routes requests to the controller. The controller optionally leverages Gemini (if `GEMINI_API_KEY` is set) for deciding next actions, while tool execution (profiles merge, activity search, writing/scoring) happens deterministically in code.

If you prefer Google’s Agent Developer Kit (ADK) or other frameworks (e.g., LangGraph), the controller is isolated so you can swap the decision layer while keeping the existing tools and schemas.

---

## Extra tools inspired by production stacks

- `tool_get_user_taste_cached(user_id)` — basic in-process cache (swap for Supabase).
- `tool_search_places_grid(query)` — grid-style discovery to broaden coverage.
- `tool_sentiment_enrich(candidates)` — stub for sentiment facets on candidates.
- `tool_calendar_probe(user_ids, time_window)` — stub for group availability checks.
- `tool_reserve_table(candidate)` — stub for reservation/booking workflows.

## Hackathon Pitch Snapshots

- **Concept** — Vivi mediates “What should we do?” decisions better than any group chat.
- **Agent Graph** — Listener → Profile → Merge → Explorer → Writer → Scheduler.
- **Demo Flow** — natural language mood input → structured intent → merged taste graph → ranked experiences with vibe scores.
- **Next** — Voice concierge, trust graphs, cross-city itineraries, and automated booking concierge.

Bring the vibes, let Vivi orchestrate the rest. </>