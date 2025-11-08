import { FormEvent, useMemo, useState } from "react";
import { fetchPlan } from "./lib/api";
import Dashboard from "./Dashboard";

type Vibe =
  | "chill"
  | "outdoors"
  | "social"
  | "artsy"
  | "nerdy"
  | "romantic"
  | "active"
  | "quiet"
  | "creative"
  | "music"
  | "adventure"
  | "mindful"
  | "party";

type PlanCard = {
  title: string;
  subtitle?: string | null;
  time?: string | null;
  price?: string | null;
  vibe: Vibe;
  energy?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  booking_url?: string | null;
  group_score: number;
  reasons: string[];
  source: string;
};

type PlanResponse = {
  query_normalized: string;
  merged_vibe: Vibe;
  energy_profile?: string | null;
  candidates: PlanCard[];
  action_log: string[];
};

const FRIENDS = [
  { id: "u1", name: "Abhiram", tags: ["music", "creative", "night"] },
  { id: "u2", name: "Nina", tags: ["outdoors", "budget", "daytime"] },
  { id: "u3", name: "Kai", tags: ["cozy", "games", "mindful"] },
  { id: "u4", name: "Sam", tags: ["party", "dance", "late-night"] },
];

export default function App() {
  const [query, setQuery] = useState(
    "We’re bored, under $20, want something outdoorsy with music near Cambridge after 5pm."
  );
  const [locationHint, setLocationHint] = useState("Cambridge, MA");
  const [timeWindow, setTimeWindow] = useState("Today 5-9pm");
  const [selectedFriends, setSelectedFriends] = useState<string[]>(["u1", "u2", "u3"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [tab, setTab] = useState<"planner" | "dashboard">("planner");

  const vibePalette: Record<Vibe, string> = useMemo(
    () => ({
      chill: "#b5c0d0",
      outdoors: "#6fc495",
      social: "#f6ad55",
      artsy: "#d6bcfa",
      nerdy: "#63b3ed",
      romantic: "#f687b3",
      active: "#f6e05e",
      quiet: "#a0aec0",
      creative: "#fbd38d",
      music: "#f687b3",
      adventure: "#68d391",
      mindful: "#9ae6b4",
      party: "#f56565",
    }),
    []
  );

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await fetchPlan({
        query_text: query,
        user_ids: selectedFriends,
        location_hint: locationHint,
        time_window: timeWindow,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch plan.");
    } finally {
      setLoading(false);
    }
  }

  function toggleFriend(id: string) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  return (
    <div className="app-shell">
      <header>
        <span className="brand">Vivi</span>
        <p className="tagline">
          The agentic social activity network. You bring the vibe. Your friends bring the time. AI
          orchestrates the plan.
        </p>
        <nav className="tabs">
          <button
            className={`tab ${tab === "planner" ? "tab--active" : ""}`}
            onClick={() => setTab("planner")}
            type="button"
          >
            Planner
          </button>
          <button
            className={`tab ${tab === "dashboard" ? "tab--active" : ""}`}
            onClick={() => setTab("dashboard")}
            type="button"
          >
            Dashboard
          </button>
        </nav>
      </header>

      <main>
        {tab === "planner" ? (
          <section className="planner-panel">
          <form onSubmit={onSubmit}>
            <label>
              Mood Input
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What's the vibe?"
                rows={4}
              />
            </label>

            <div className="inputs-grid">
              <label>
                Where?
                <input
                  value={locationHint}
                  onChange={(e) => setLocationHint(e.target.value)}
                  placeholder="Neighborhood or city"
                />
              </label>
              <label>
                When?
                <input
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  placeholder="e.g. Tonight 6-9pm"
                />
              </label>
            </div>

            <fieldset className="friends">
              <legend>Tag friends to merge their vibes</legend>
              <div className="chips">
                {FRIENDS.map((friend) => {
                  const active = selectedFriends.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      className={`chip ${active ? "chip--active" : ""}`}
                      onClick={() => toggleFriend(friend.id)}
                    >
                      <span>{friend.name}</span>
                      <small>{friend.tags.join(" · ")}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Orchestrating..." : "Spin up a plan"}
            </button>
          </form>
          <aside className="concept">
            <h2>Agent Graph</h2>
            <p>
              Vivi listens to your mood, retrieves everyone’s preferences, merges the vibes, scouts
              the city, and drafts a ready-to-book plan card — all in seconds.
            </p>
            <ul>
              <li>
                <strong>Listener</strong> parses emotion + intent.
              </li>
              <li>
                <strong>Profile</strong> maps taste graphs.
              </li>
              <li>
                <strong>Merge</strong> finds the overlap.
              </li>
              <li>
                <strong>Explorer</strong> combs APIs for matches.
              </li>
              <li>
                <strong>Writer</strong> crafts vibe cards.
              </li>
              <li>
                <strong>Scheduler</strong> syncs the squad.
              </li>
            </ul>
          </aside>
        </section>
        ) : (
          <section className="planner-panel">
            <Dashboard />
          </section>
        )}

        <section className="results-panel">
          {error && <div className="error">{error}</div>}
          {!loading && !error && !result && (
            <p className="placeholder">Drop a vibe above to see Vivi’s picks.</p>
          )}

          {loading && <p className="placeholder">Synthesizing mood graph...</p>}

          {result && (
            <>
              <div className="summary">
                <div>
                  <h2>Top Picks for “{result.query_normalized}”</h2>
                  <p>
                    Shared vibe: <span className="badge">{result.merged_vibe}</span>{" "}
                    {result.energy_profile && (
                      <>
                        · Energy:{" "}
                        <span className="badge badge--muted">{result.energy_profile}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="log">
                  {result.action_log.map((entry, idx) => (
                    <span key={idx}>{entry}</span>
                  ))}
                </div>
              </div>
              <div className="cards-grid">
                {result.candidates.map((card) => (
                  <article key={card.title} className="plan-card">
                    <header>
                      <h3>{card.title}</h3>
                      <span
                        className="vibe-pill"
                        style={{ backgroundColor: vibePalette[card.vibe] ?? "#CBD5F5" }}
                      >
                        {card.vibe}
                      </span>
                    </header>
                    <p className="meta">
                      {card.price ? `Price: ${card.price}` : "Price: —"} ·{" "}
                      {card.distance_km ? `${card.distance_km} km` : "distance unknown"}
                    </p>
                    {card.energy && <p className="meta">Energy match: {card.energy}</p>}
                    {card.address && <p className="address">{card.address}</p>}
                    <ul className="reason-list">
                      {card.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <footer>
                      <span className="score">Score {Math.round(card.group_score * 100)}%</span>
                      {card.booking_url && (
                        <a href={card.booking_url} target="_blank" rel="noreferrer">
                          Book / Share
                        </a>
                      )}
                    </footer>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </main>

      <footer>
        <p>
          Built for crews who ask “What should we do?” Vivi learns your vibe signatures and keeps the
          energy flowing.
        </p>
      </footer>
    </div>
  );
}

