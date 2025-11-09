import { CSSProperties, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { EventItem, fetchEvents, fetchPlan } from "./lib/api";

type PlanCard = {
  title: string;
  subtitle?: string | null;
  time?: string | null;
  price?: string | null;
  vibe?: string | null;
  energy?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  booking_url?: string | null;
  maps_url?: string | null;
  summary?: string | null;
  group_score: number;
  reasons: string[];
  source: string;
};

type PlanResponse = {
  query_normalized: string;
  merged_vibe?: string | null;
  energy_profile?: string | null;
  candidates: PlanCard[];
  action_log: string[];
};

const FRIENDS = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Alex",
    tags: ["music", "creative", "night"],
    defaultLikes: "live music, coffee tastings",
    defaultVibes: "music, creative",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Jade",
    tags: ["outdoors", "budget", "daytime"],
    defaultLikes: "outdoor markets, kayaking",
    defaultVibes: "outdoors, adventure",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Max",
    tags: ["cozy", "games", "mindful"],
    defaultLikes: "board games, tea houses",
    defaultVibes: "quiet, mindful",
  },
];

type FriendInputState = {
  likes: string;
  vibes: string;
  tags: string;
  budget: string;
  distance: string;
};

type EventProviderOption = "all" | "eventbrite" | "google_places";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export default function App() {
  const [query, setQuery] = useState(
    "We’re bored, under $20, want something outdoorsy with music near Cambridge after 5pm."
  );
  const [locationHint, setLocationHint] = useState("Cambridge, MA");
  const [timeWindow, setTimeWindow] = useState("Today 5-9pm");
  const [vibeHint, setVibeHint] = useState("music");
  const [budgetCap, setBudgetCap] = useState<string>("20");
  const [distanceKm, setDistanceKm] = useState<string>("5");
  const [customLikes, setCustomLikes] = useState("live music, sunset picnic");
  const [customTags, setCustomTags] = useState("outdoor, group, evening");
  const [selectedFriends, setSelectedFriends] = useState<string[]>(FRIENDS.slice(0, 2).map((f) => f.id));
  const [friendInputs, setFriendInputs] = useState<Record<string, FriendInputState>>(() => {
    const entries = FRIENDS.map((friend) => [
      friend.id,
      {
        likes: friend.defaultLikes ?? "",
        vibes: friend.defaultVibes ?? "",
        tags: friend.tags.join(", "),
        budget: "",
        distance: "",
      },
    ]);
    return Object.fromEntries(entries);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [lastContext, setLastContext] = useState<{
    location: string;
    time: string;
    vibeHint?: string;
    budget?: number;
    distance?: number;
    likes: string[];
    tags: string[];
  } | null>(null);

  const [eventQuery, setEventQuery] = useState("live music");
  const [eventLocation, setEventLocation] = useState("Cambridge, MA");
  const [eventVibeFilter, setEventVibeFilter] = useState("music");
  const [eventProvider, setEventProvider] = useState<EventProviderOption>("all");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

  const vibePalette = useMemo(() => {
    return {
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
      sports: "#60a5fa",
    } as Record<string, string>;
  }, []);

  const performEventSearch = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const likesArray = splitList(customLikes);
      const tagsArray = splitList(customTags);
      const data = await fetchEvents({
        q: eventQuery || undefined,
        location: eventLocation || undefined,
        vibe: eventVibeFilter || undefined,
        provider: eventProvider === "all" ? undefined : eventProvider,
        likes: likesArray,
        tags: tagsArray,
        limit: 20,
      });
      setEvents(data);
      if (data.length > 0) {
        setActiveEventId(data[0].id);
      } else {
        setActiveEventId(null);
      }
    } catch (err) {
      setEvents([]);
      setActiveEventId(null);
      setEventsError(err instanceof Error ? err.message : "Failed to fetch events.");
    } finally {
      setEventsLoading(false);
    }
  }, [customLikes, customTags, eventLocation, eventProvider, eventQuery, eventVibeFilter]);

  useEffect(() => {
    void performEventSearch();
  }, [performEventSearch]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setLastContext(null);

    try {
      const likesArray = splitList(customLikes);
      const tagsArray = splitList(customTags);

      const friendOverrides = selectedFriends.map((id) => {
        const inputs = friendInputs[id] || {
          likes: "",
          vibes: "",
          tags: "",
          budget: "",
          distance: "",
        };
        return {
          user_id: id,
          display_name: FRIENDS.find((f) => f.id === id)?.name,
          likes: splitList(inputs.likes),
          vibes: splitList(inputs.vibes),
          tags: splitList(inputs.tags),
          budget_max: inputs.budget ? Number(inputs.budget) : undefined,
          distance_km_max: inputs.distance ? Number(inputs.distance) : undefined,
        };
      });

      const data = await fetchPlan({
        query_text: query,
        user_ids: selectedFriends,
        location_hint: locationHint,
        time_window: timeWindow,
        vibe_hint: vibeHint || undefined,
        budget_cap: budgetCap ? Number(budgetCap) : undefined,
        distance_km: distanceKm ? Number(distanceKm) : undefined,
        custom_likes: likesArray,
        custom_tags: tagsArray,
        friend_overrides: friendOverrides,
      });
      setResult(data);
      setLastContext({
        location: locationHint,
        time: timeWindow,
        vibeHint: vibeHint || undefined,
        budget: budgetCap ? Number(budgetCap) : undefined,
        distance: distanceKm ? Number(distanceKm) : undefined,
        likes: likesArray,
        tags: tagsArray,
      });
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

  function handleEventSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void performEventSearch();
  }

  function handleEventCardClick(event: EventItem) {
    setActiveEventId(event.id);
  }

  const topScore =
    result?.candidates?.length ? Math.max(...result.candidates.map((c) => c.group_score)) : null;
  const displayScore = topScore ? Math.round(topScore * 100) : 62;
  const friendObjects = FRIENDS.filter((f) => selectedFriends.includes(f.id));

  return (
    <div className="map-layout">
      <AnimatedBackdrop />

      <header className="top-bar">
        <span className="logo">Challo</span>
        <div className="top-bar__meta">
          <span>Agent graph</span>
          <span>Eventbrite</span>
          <span>Google Places</span>
        </div>
      </header>

      <section className="center-stage">
        <SimilarityOrb score={displayScore} friends={friendObjects.map((f) => f.name)} />
        <OrbitingTags
          tags={Array.from(new Set([...splitList(customTags), ...(vibeHint ? [vibeHint] : [])]))
            .slice(0, 8)
            .map((t) => t.trim())
            .filter(Boolean)}
        />
      </section>

      <section className="control-stack">
        <form className="panel query-card" onSubmit={onSubmit}>
          <label className="query-card__prompt">
            <span>What do you feel like?</span>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={2}
              placeholder="Tonight we're broke but want outdoorsy music near Cambridge."
            />
          </label>

          <div className="query-grid">
            <label>
              Location
              <input
                value={locationHint}
                onChange={(e) => setLocationHint(e.target.value)}
                placeholder="Cambridge, MA"
              />
            </label>
            <label>
              Time
              <input
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                placeholder="Tonight 5-9pm"
              />
            </label>
          </div>

 		    <div className="query-grid">
            <label>
              Interests
              <input
                value={customLikes}
                onChange={(e) => setCustomLikes(e.target.value)}
                placeholder="live music, sunset picnic"
              />
            </label>
            <label>
              Tags
              <input
                value={customTags}
                onChange={(e) => setCustomTags(e.target.value)}
                placeholder="outdoor, group, evening"
              />
            </label>
          </div>

          <div className="chip-row">
            <label>
              Vibe
              <input
                value={vibeHint}
                onChange={(e) => setVibeHint(e.target.value)}
                placeholder="music"
              />
            </label>
            <label>
              Budget $
              <input
                value={budgetCap}
                onChange={(e) => setBudgetCap(e.target.value)}
                type="number"
                min="0"
              />
            </label>
            <label>
              Radius km
              <input
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                type="number"
                min="0"
              />
            </label>
          </div>

          <details className="query-advanced">
            <summary>Friends & providers</summary>
            <div className="friend-chips">
              {FRIENDS.map((friend) => {
                const active = selectedFriends.includes(friend.id);
                return (
                  <button
                    key={friend.id}
                    type="button"
                    className={`friend-chip ${active ? "friend-chip--active" : ""}`}
                    onClick={() => toggleFriend(friend.id)}
                  >
                    <span>{friend.name}</span>
                    <small>{friend.tags.join(" · ")}</small>
                  </button>
                );
              })}
            </div>

            {selectedFriends.map((friendId) => {
              const friend = FRIENDS.find((f) => f.id === friendId);
              const inputs = friendInputs[friendId] || {
                likes: "",
                vibes: "",
                tags: "",
                budget: "",
                distance: "",
              };
              return (
                <div key={friendId} className="friend-card">
                  <header>
                    <span>{friend?.name ?? friendId}</span>
                    <small>{friend?.tags.join(" / ")}</small>
                  </header>
                  <div className="query-grid">
                    <label>
                      Likes
                      <input
                        value={inputs.likes}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, likes: e.target.value },
                          }))
                        }
                        placeholder="live music"
                      />
                    </label>
                    <label>
                      Vibes
                      <input
                        value={inputs.vibes}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, vibes: e.target.value },
                          }))
                        }
                        placeholder="creative"
                      />
                    </label>
                  </div>
                  <div className="query-grid">
                    <label>
                      Tags
                      <input
                        value={inputs.tags}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, tags: e.target.value },
                          }))
                        }
                        placeholder="outdoor"
                      />
                    </label>
                    <label>
                      Budget $
                      <input
                        type="number"
                        min="0"
                        value={inputs.budget}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, budget: e.target.value },
                          }))
                        }
                      />
                    </label>
                    <label>
                      Radius km
                      <input
                        type="number"
                        min="0"
                        value={inputs.distance}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, distance: e.target.value },
                          }))
                        }
                      />
                    </label>
                  </div>
                </div>
              );
            })}

            <label className="provider-select">
              Provider
              <select
                value={eventProvider}
                onChange={(e) => setEventProvider(e.target.value as EventProviderOption)}
              >
                <option value="all">Eventbrite + Google Places</option>
                <option value="eventbrite">Eventbrite only</option>
                <option value="google_places">Google Places only</option>
              </select>
            </label>
          </details>

          <div className="query-actions">
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Finding matches..." : "Show events"}
            </button>
            {error && <div className="inline-error">{error}</div>}
          </div>
        </form>

        <div className="panel result-card">
          {loading && <p className="placeholder">Synthesizing picks...</p>}
          {!loading && !result && !error && (
            <p className="placeholder">Enter a mood and interests to surface events on the map.</p>
          )}
          {result && (
            <>
              <header className="result-card__header">
                <h2>{result.query_normalized}</h2>
                <div className="tag-chip-row">
                  {result.merged_vibe && <span className="tag-chip">{result.merged_vibe}</span>}
                  {result.energy_profile && (
                    <span className="tag-chip tag-chip--muted">{result.energy_profile}</span>
                  )}
                </div>
              </header>
              {result.candidates.length === 0 ? (
                <p className="placeholder">
                  No live matches. Try widening the radius or tweaking your keywords.
                </p>
              ) : (
                <ul className="result-list">
                  {result.candidates.map((card) => (
                    <li key={card.title} className="result-list__item">
                      <div>
                        <strong>{card.title}</strong>
                        {card.address && <span>{card.address}</span>}
                      </div>
                      <p>
                        {card.price ? card.price : "Price: —"} ·{" "}
                        {card.distance_km ? `${card.distance_km} km` : "distance unknown"} ·{" "}
                        <span className="source-pill">{card.source}</span>
                      </p>
                      {card.summary && <p className="summary-text">{card.summary}</p>}
                      <footer>
                        <span className="score">{Math.round(card.group_score * 100)}%</span>
                        <div className="links">
                          {card.booking_url && (
                            <a href={card.booking_url} target="_blank" rel="noreferrer">
                              Event
                            </a>
                          )}
                          {card.maps_url && (
                            <a href={card.maps_url} target="_blank" rel="noreferrer">
                              Map
                            </a>
                          )}
                        </div>
                      </footer>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </section>

      <aside className="event-board">
        <form className="event-board__form" onSubmit={handleEventSearchSubmit}>
          <input
            value={eventQuery}
            onChange={(e) => setEventQuery(e.target.value)}
            placeholder="Keyword"
          />
          <input
            value={eventLocation}
            onChange={(e) => setEventLocation(e.target.value)}
            placeholder="Location"
          />
          <input
            value={eventVibeFilter}
            onChange={(e) => setEventVibeFilter(e.target.value)}
            placeholder="Vibe"
          />
          <button type="submit" disabled={eventsLoading}>
            {eventsLoading ? "..." : "Refresh"}
          </button>
        </form>

        <div className="event-board__list">
          {eventsError && <div className="inline-error">{eventsError}</div>}
          {!eventsError && eventsLoading && <p className="placeholder">Loading events...</p>}
          {!eventsError && !eventsLoading && events.length === 0 && (
            <p className="placeholder">No events matched. Try new keywords.</p>
          )}
          {events.map((event) => (
            <button
              key={event.id}
              type="button"
              className={`event-card ${activeEventId === event.id ? "event-card--active" : ""}`}
              onClick={() => handleEventCardClick(event)}
            >
              <div>
                <span className="event-card__title">{event.title}</span>
                <span className="event-card__meta">
                  {event.venue ?? event.address ?? "TBA"} · {event.price ?? "—"}
                </span>
              </div>
              <span className="source-pill">{event.source}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function SimilarityOrb({ score, friends }: { score: number; friends: string[] }) {
  const degree = Math.max(0, Math.min(100, score)) * 3.6;
  const style = {
    ["--meter-deg" as any]: `${degree}deg`,
  } as CSSProperties;

  const friendAngles = friends.length
    ? friends.map((_, idx) => (idx / friends.length) * 360)
    : [0, 120, 240];

  return (
    <div className="orb" style={style}>
      <div className="orb__glow" />
      <div className="orb__ring" />
      <div className="orb__content">
        <div className="orb__score">{score}%</div>
        <div className="orb__label">Group Match</div>
      </div>
      <div className="orb__friends">
        {friends.map((name, i) => {
          const angle = friendAngles[i] ?? 0;
          const transform = `rotate(${angle}deg) translateY(-8.2rem) rotate(${-angle}deg)`;
          const initials = name
            .split(" ")
            .map((s) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <div key={name} className="friend-node" style={{ transform }}>
              <span>{initials}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrbitingTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div className="orbiters">
      {tags.map((tag, idx) => {
        const size = 160 + (idx % 4) * 26;
        const dur = 14 + (idx % 5) * 2;
        return (
          <div
            key={`${tag}-${idx}`}
            className="orbiter"
            style={
              {
                ["--orbit-size" as any]: `${size}px`,
                ["--orbit-duration" as any]: `${dur}s`,
              } as CSSProperties
            }
          >
            <span>{tag}</span>
          </div>
        );
      })}
    </div>
  );
}

function AnimatedBackdrop() {
  return (
    <div className="backdrop">
      <div className="blob blob--1" />
      <div className="blob blob--2" />
      <div className="blob blob--3" />
      <div className="grid-lights" />
    </div>
  );
}

