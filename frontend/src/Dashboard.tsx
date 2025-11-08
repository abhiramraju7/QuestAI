import { useEffect, useState } from "react";
import { fetchDashboard } from "./lib/api";

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

type DashboardResponse = {
  top_picks: PlanCard[];
  trending_events: Array<Record<string, any>>;
  vibe_stats: Array<{ vibe: string; count: number }>;
  meta: { location: string; vibe: string; time_window: string; users: string[] };
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetchDashboard({
          location: "Cambridge, MA",
          time_window: "today 5-9pm",
          user_ids: "u1,u2,u3",
        });
        if (mounted) setData(res);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <p className="placeholder">Loading dashboard…</p>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return (
    <div className="dashboard">
      <section className="summary">
        <h2>Social Dashboard</h2>
        <p>
          Location: <strong>{data.meta.location}</strong> · Vibe focus:{" "}
          <span className="badge">{data.meta.vibe}</span> · Time:{" "}
          <span className="badge badge--muted">{data.meta.time_window}</span>
        </p>
      </section>

      <section className="cards-grid">
        {data.top_picks.map((card) => (
          <article key={card.title} className="plan-card">
            <header>
              <h3>{card.title}</h3>
              <span className="vibe-pill">{card.vibe}</span>
            </header>
            <p className="meta">
              {card.price ? `Price: ${card.price}` : "Price: —"} ·{" "}
              {card.distance_km ? `${card.distance_km} km` : "distance unknown"}
            </p>
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
      </section>

      <section className="events">
        <h3>Trending Events</h3>
        <div className="events-grid">
          {data.trending_events.map((ev, idx) => (
            <div key={idx} className="event-card">
              <div className="event-title">{String(ev.title ?? "Untitled")}</div>
              <div className="event-meta">
                <span>{ev.price ?? "—"}</span>
                {ev.address && <span> · {ev.address}</span>}
              </div>
              {ev.booking_url && (
                <a href={ev.booking_url} target="_blank" rel="noreferrer">
                  View
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="vibe-stats">
        <h3>Group Vibe Stats</h3>
        <div className="chips">
          {data.vibe_stats.map((vs) => (
            <span key={vs.vibe} className="chip">
              {vs.vibe} <small>×{vs.count}</small>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}


