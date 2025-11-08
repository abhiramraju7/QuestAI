/// <reference path="./types/react-shim.d.ts" />
import React from "react";
import { useMemo, useState } from "react";
import Constellation, {
  ConstellationActivity,
  ConstellationUser,
} from "./components/Constellation";
import type { CSSProperties } from "react";
import { fetchPlan } from "./lib/api";

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

type Person = {
  id: string;
  name: string;
  initials: string;
  color: string;
  bio: string;
  tags: string[];
};

const PEOPLE: Person[] = [
  {
    id: "u1",
    name: "Aria",
    initials: "AR",
    color: "#7dd3fc",
    bio: "Live sets, latte art, late nights.",
    tags: ["music", "creative", "night"],
  },
  {
    id: "u2",
    name: "Noah",
    initials: "NO",
    color: "#86efac",
    bio: "Sunsets, markets, kayaks.",
    tags: ["outdoors", "budget", "daytime"],
  },
  {
    id: "u3",
    name: "Kai",
    initials: "KA",
    color: "#c7d2fe",
    bio: "Indie films and tea houses.",
    tags: ["cozy", "games", "mindful"],
  },
  {
    id: "u4",
    name: "Sana",
    initials: "SA",
    color: "#fca5a5",
    bio: "Dance floors and neon nights.",
    tags: ["party", "dance", "late-night"],
  },
];

export default function App() {
  const [selectedId, setSelectedId] = useState<string>(PEOPLE[0].id);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personResult, setPersonResult] = useState<Record<string, PlanResponse | null>>({});
  const [groupResult, setGroupResult] = useState<PlanResponse | null>(null);
  const [selectedCard, setSelectedCard] = useState<PlanCard | null>(null);

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

  const selectedPerson = PEOPLE.find((p) => p.id === selectedId)!;

  async function generateForPerson(personId: string) {
    setLoading(true);
    setError(null);
    setGroupResult(null);
    try {
      const data = await fetchPlan({
        query_text: "Generate a few great activities based on this profile’s vibe.",
        user_ids: [personId],
        location_hint: "Cambridge, MA",
        time_window: "Tonight 5-9pm",
      });
      setPersonResult((prev: Record<string, PlanResponse | null>) => ({ ...prev, [personId]: data }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch activities.");
    } finally {
      setLoading(false);
    }
  }

  async function generateForGroup() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlan({
        query_text: "Plan something the whole group will love.",
        user_ids: PEOPLE.map((p) => p.id),
        location_hint: "Cambridge, MA",
        time_window: "Tonight 5-9pm",
      });
      setGroupResult(data);
      setSelectedCard(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch group plan.");
    } finally {
      setLoading(false);
    }
  }

  const SAMPLE_NODES: PlanCard[] = useMemo(
    () => [
      {
        title: "Riverside Jazz Picnic",
        subtitle: null,
        time: "Tonight 6-8pm",
        price: "free",
        vibe: "music",
        energy: "medium",
        address: "Riverbend Park, Cambridge",
        lat: null,
        lng: null,
        distance_km: 2,
        booking_url: null,
        group_score: 0.92,
        reasons: ["Matches vibe: music", "Budget OK: free"],
        source: "cached",
      },
      {
        title: "Night Market Crawl",
        subtitle: null,
        time: "7-10pm",
        price: "$",
        vibe: "creative",
        energy: "high",
        address: "Union Sq, Somerville",
        lat: null,
        lng: null,
        distance_km: 3.1,
        booking_url: null,
        group_score: 0.74,
        reasons: ["Creative tags overlap", "Walkable"],
        source: "cached",
      },
      {
        title: "Trivia Bar",
        subtitle: null,
        time: "8-10pm",
        price: "$",
        vibe: "social",
        energy: "medium",
        address: "Central Sq",
        lat: null,
        lng: null,
        distance_km: 1.2,
        booking_url: null,
        group_score: 0.63,
        reasons: ["Social vibe match"],
        source: "cached",
      },
      {
        title: "Indie Film + Tea",
        subtitle: null,
        time: "6:30-9pm",
        price: "$",
        vibe: "mindful",
        energy: "low",
        address: "Somerville Theatre",
        lat: null,
        lng: null,
        distance_km: 4.1,
        booking_url: null,
        group_score: 0.68,
        reasons: ["Mindful night activity"],
        source: "cached",
      },
      {
        title: "Kayak Sunset",
        subtitle: null,
        time: "5-7pm",
        price: "$",
        vibe: "adventure",
        energy: "high",
        address: "Charles River",
        lat: null,
        lng: null,
        distance_km: 2.7,
        booking_url: null,
        group_score: 0.58,
        reasons: ["Outdoor + sunset"],
        source: "cached",
      },
      {
        title: "Gallery Pop-up",
        subtitle: null,
        time: "6-9pm",
        price: "free",
        vibe: "artsy",
        energy: "medium",
        address: "SoWa",
        lat: null,
        lng: null,
        distance_km: 5.6,
        booking_url: null,
        group_score: 0.71,
        reasons: ["Creative, free"],
        source: "cached",
      },
    ],
    []
  );

  const nodes: PlanCard[] = useMemo(
    () => groupResult?.candidates ?? SAMPLE_NODES,
    [groupResult, SAMPLE_NODES]
  );

  const constellationUsers: ConstellationUser[] = useMemo(
    () =>
      PEOPLE.map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        hobbies: p.tags,
      })),
    []
  );

  const constellationActivities: ConstellationActivity[] = useMemo(
    () =>
      nodes.map((c, i) => ({
        id: `${i}-${c.title}`,
        title: c.title,
        vibe: c.vibe,
        reasons: c.reasons,
      })),
    [nodes]
  );

  function colorFromScore(score: number): string {
    const clamped = Math.max(0, Math.min(1, score));
    // interpolate hue: 30 (orange) -> 265 (violet) by score
    const hue = 30 + (265 - 30) * clamped;
    return `hsl(${Math.round(hue)} 85% 65% / 0.6)`;
  }

  function orbitVars(idx: number, total: number): CSSProperties {
    const baseRadius = 120;
    const radiusStep = 50;
    const layer = idx % 3;
    const r = baseRadius + layer * radiusStep;
    const angle = (360 / total) * idx;
    const duration = 28 + (idx % 5) * 6;
    return {
      ["--r" as any]: `${r}px`,
      ["--a" as any]: `${angle}deg`,
      ["--d" as any]: `${duration}s`,
    } as CSSProperties;
  }

  function onNodeClick(card: PlanCard) {
    setSelectedCard(card);
  }

  function sendReaction(card: PlanCard, emoji: string) {
    // TODO: Wire to backend feedback endpoint
    console.log("Reaction", { title: card.title, emoji });
  }

  return (
    <div className="app-shell">
      <header>
        <span className="brand">Quest Mode</span>
        <p className="tagline">Agentic activity circles for your crew.</p>
      </header>

      <main className="qm-layout">
        <section className="qm-hub">
          <div className="qm-center">
            <div className={`qm-logo ${loading ? "qm-logo--pulse" : ""}`}>Quest Mode</div>
            <button className="primary qm-group-btn" onClick={generateForGroup} disabled={loading}>
              {loading ? "Computing alignment..." : "Generate group plan"}
            </button>
          </div>
          <Constellation
            users={constellationUsers}
            activities={constellationActivities}
            onSelect={(a) => {
              // find matching card to show detail
              const card = nodes.find((c) => c.title === a.title) || nodes[0];
              onNodeClick(card);
            }}
            height={560}
          />
        </section>

        <section className="qm-panel">
          {error && <div className="error">{error}</div>}

          {groupResult && (
            <div className="constraints-card">
              <h3>Group plan</h3>
              <div className="cards-grid">
                {groupResult.candidates.map((card: PlanCard) => (
                  <article key={card.title} className="plan-card">
                    <header>
                      <h3>{card.title}</h3>
                      <span
                        className="vibe-pill"
                        style={{ backgroundColor: vibePalette[card.vibe as Vibe] ?? "#CBD5F5" }}
                      >
                        {card.vibe}
                      </span>
                    </header>
                    <p className="meta">
                      {card.price ? `Price: ${card.price}` : "Price: —"} ·{" "}
                      {card.distance_km ? `${card.distance_km} km` : "distance unknown"} ·{" "}
                      <span className="source-pill">{card.source}</span>
                    </p>
                    {card.address && <p className="address">{card.address}</p>}
                    <ul className="reason-list">
                      {card.reasons.map((reason: string) => (
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
            </div>
          )}

          {selectedCard && (
            <div className="constraints-card">
              <h3>{selectedCard.title}</h3>
              <p className="meta">
                {selectedCard.address ? selectedCard.address : "address unknown"} ·{" "}
                {selectedCard.price ?? "—"} · {selectedCard.vibe}
              </p>
              <div className="qm-reactions">
                {["👍", "🔥", "💜", "🤔", "👎"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    className="qm-reaction"
                    onClick={() => sendReaction(selectedCard, e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <div className="cards-grid">
                <article className="plan-card">
                  <header>
                    <h3>{selectedCard.title}</h3>
                    <span
                      className="vibe-pill"
                      style={{ backgroundColor: vibePalette[selectedCard.vibe as Vibe] ?? "#CBD5F5" }}
                    >
                      {selectedCard.vibe}
                    </span>
                  </header>
                  <p className="meta">
                    {selectedCard.price ? `Price: ${selectedCard.price}` : "Price: —"} ·{" "}
                    {selectedCard.distance_km ? `${selectedCard.distance_km} km` : "distance unknown"} ·{" "}
                    <span className="source-pill">{selectedCard.source}</span>
                  </p>
                  {selectedCard.address && <p className="address">{selectedCard.address}</p>}
                  <ul className="reason-list">
                    {selectedCard.reasons.map((reason: string) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <footer>
                    <span className="score">Score {Math.round(selectedCard.group_score * 100)}%</span>
                    {selectedCard.booking_url && (
                      <a href={selectedCard.booking_url} target="_blank" rel="noreferrer">
                        Book / Share
                      </a>
                    )}
                  </footer>
                </article>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer>
        <p>Powered by an agentic planning graph.</p>
      </footer>
    </div>
  );
}

