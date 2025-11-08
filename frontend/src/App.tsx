import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { EventItem, fetchEvents, fetchPlan } from "./lib/api";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || "";

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

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

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupRef = useRef<mapboxgl.Popup | null>(null);

  const hasMapboxToken = Boolean(MAPBOX_TOKEN);

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

  useEffect(() => {
    if (!hasMapboxToken || !mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-71.0589, 42.3601],
      zoom: 11,
    });

    map.addControl(new mapboxgl.NavigationControl(), "top-right");
    const handleClick = () => setActiveEventId(null);
    map.on("click", handleClick);

    mapRef.current = map;

    return () => {
      map.off("click", handleClick);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [hasMapboxToken]);

  useEffect(() => {
    if (!mapRef.current || !hasMapboxToken) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (events.length === 0) {
      popupRef.current?.remove();
      popupRef.current = null;
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();

    events.forEach((event) => {
      if (typeof event.lng !== "number" || typeof event.lat !== "number") {
        return;
      }

      const marker = new mapboxgl.Marker({
        color: event.source === "eventbrite" ? "#f97316" : "#38bdf8",
      })
        .setLngLat([event.lng, event.lat])
        .addTo(mapRef.current!);

      marker.getElement().addEventListener("click", () => {
        setActiveEventId(event.id);
      });

      markersRef.current.push(marker);
      bounds.extend([event.lng, event.lat]);
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 800 });
    }
  }, [events, hasMapboxToken]);

  useEffect(() => {
    if (!mapRef.current || !hasMapboxToken) {
      return;
    }

    popupRef.current?.remove();
    popupRef.current = null;

    if (!activeEventId) {
      return;
    }

    const event = events.find((item) => item.id === activeEventId);
    if (!event || typeof event.lng !== "number" || typeof event.lat !== "number") {
      return;
    }

    const html = `
      <div class="map-popup">
        <strong>${event.title}</strong>
        ${event.venue ? `<p>${event.venue}</p>` : ""}
        ${
          event.booking_url
            ? `<a href="${event.booking_url}" target="_blank" rel="noreferrer">Event Link</a>`
            : ""
        }
        ${
          event.maps_url
            ? `<a href="${event.maps_url}" target="_blank" rel="noreferrer">Directions</a>`
            : ""
        }
      </div>
    `;

    popupRef.current = new mapboxgl.Popup({ closeOnClick: true, maxWidth: "260px" })
      .setLngLat([event.lng, event.lat])
      .setHTML(html)
      .addTo(mapRef.current);

    mapRef.current.easeTo({ center: [event.lng, event.lat], zoom: 13, duration: 600 });
  }, [activeEventId, events, hasMapboxToken]);

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
    if (mapRef.current && typeof event.lng === "number" && typeof event.lat === "number") {
      mapRef.current.easeTo({ center: [event.lng, event.lat], zoom: 13, duration: 600 });
    }
  }

  return (
    <div className="app-shell">
      <header>
        <span className="brand">Vivi</span>
        <p className="tagline">
          The agentic social activity network. You bring the vibe. Your friends bring the time. AI
          orchestrates the plan.
        </p>
      </header>

      <main>
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

            <div className="inputs-grid">
              <label>
                Optional vibe hint
                <input
                  value={vibeHint}
                  onChange={(e) => setVibeHint(e.target.value)}
                  placeholder="music, outdoors, romantic..."
                />
              </label>
              <label>
                Budget cap (USD)
                <input
                  value={budgetCap}
                  onChange={(e) => setBudgetCap(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="20"
                />
              </label>
              <label>
                Distance max (km)
                <input
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(e.target.value)}
                  type="number"
                  min="0"
                  placeholder="5"
                />
              </label>
            </div>

            <label>
              Custom likes (comma separated)
              <input
                value={customLikes}
                onChange={(e) => setCustomLikes(e.target.value)}
                placeholder="live music, cafe crawl, art pop-up"
              />
            </label>

            <label>
              Tags or constraints (comma separated)
              <input
                value={customTags}
                onChange={(e) => setCustomTags(e.target.value)}
                placeholder="outdoor, group-friendly, free"
              />
            </label>

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
                <div key={friendId} className="friend-overrides">
                  <h3>{friend?.name ?? friendId}</h3>
                  <div className="inputs-grid">
                    <label>
                      Likes / activities
                      <input
                        value={inputs.likes}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, likes: e.target.value },
                          }))
                        }
                        placeholder="live music, pottery class..."
                      />
                    </label>
                    <label>
                      Preferred vibes
                      <input
                        value={inputs.vibes}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, vibes: e.target.value },
                          }))
                        }
                        placeholder="music, adventure..."
                      />
                    </label>
                  </div>
                  <div className="inputs-grid">
                    <label>
                      Tags / constraints
                      <input
                        value={inputs.tags}
                        onChange={(e) =>
                          setFriendInputs((prev) => ({
                            ...prev,
                            [friendId]: { ...inputs, tags: e.target.value },
                          }))
                        }
                        placeholder="nightlife, outdoor..."
                      />
                    </label>
                    <label>
                      Budget max (USD)
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
                        placeholder="25"
                      />
                    </label>
                    <label>
                      Distance max (km)
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
                        placeholder="5"
                      />
                    </label>
                  </div>
                </div>
              );
            })}

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
                  {(result.merged_vibe || result.energy_profile) && (
                    <p>
                      {result.merged_vibe && (
                        <>
                          Shared vibe: <span className="badge">{result.merged_vibe}</span>{" "}
                        </>
                      )}
                      {result.energy_profile && (
                        <>
                          Energy:{" "}
                          <span className="badge badge--muted">{result.energy_profile}</span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <div className="log">
                  {result.action_log.map((entry, idx) => (
                    <span key={idx}>{entry}</span>
                  ))}
                </div>
              </div>
              {result.candidates.length === 0 && (
                <div className="empty-state">
                  <h3>No live matches yet</h3>
                  <p>
                    Vivi called Google Places and Eventbrite but they didn't return any hits for the
                    current settings. Try widening the distance, budget, or tweak the vibe keywords.
                  </p>
                </div>
              )}
              {lastContext && (
                <div className="constraints-card">
                  <h3>Planner inputs</h3>
                  <div className="constraint-grid">
                    <span>
                      <strong>Where:</strong> {lastContext.location}
                    </span>
                    <span>
                      <strong>When:</strong> {lastContext.time}
                    </span>
                    {lastContext.vibeHint && (
                      <span>
                        <strong>Vibe hint:</strong> {lastContext.vibeHint}
                      </span>
                    )}
                    {lastContext.budget !== undefined && (
                      <span>
                        <strong>Budget ≤</strong> ${lastContext.budget}
                      </span>
                    )}
                    {lastContext.distance !== undefined && (
                      <span>
                        <strong>Radius ≤</strong> {lastContext.distance} km
                      </span>
                    )}
                    {lastContext.likes.length > 0 && (
                      <span className="list-line">
                        <strong>Likes:</strong> {lastContext.likes.join(", ")}
                      </span>
                    )}
                    {lastContext.tags.length > 0 && (
                      <span className="list-line">
                        <strong>Tags:</strong> {lastContext.tags.join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              )}
              <div className="cards-grid">
                {result.candidates.map((card) => (
                  <article key={card.title} className="plan-card">
                    <header>
                      <div>
                        <h3>{card.title}</h3>
                        {card.address && <p className="address">{card.address}</p>}
                      </div>
                      {card.vibe && (
                        <span
                          className="vibe-pill"
                          style={{
                            backgroundColor:
                              vibePalette[card.vibe.toLowerCase()] ?? "#CBD5F5",
                          }}
                        >
                          {card.vibe}
                        </span>
                      )}
                    </header>
                    <p className="meta">
                      {card.price ? `Price: ${card.price}` : "Price: —"} ·{" "}
                      {card.distance_km ? `${card.distance_km} km` : "distance unknown"} ·{" "}
                      <span className="source-pill">{card.source}</span>
                    </p>
                    {card.energy && <p className="meta">Energy match: {card.energy}</p>}
                    {card.time && <p className="meta">Suggested time: {card.time}</p>}
                    {card.summary && <p className="summary">{card.summary}</p>}
                    <ul className="reason-list">
                      {card.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <footer>
                      <span className="score">Score {Math.round(card.group_score * 100)}%</span>
                      <div className="links">
                        {card.booking_url && (
                          <a href={card.booking_url} target="_blank" rel="noreferrer">
                            Event Link
                          </a>
                        )}
                        {card.maps_url && (
                          <a href={card.maps_url} target="_blank" rel="noreferrer">
                            Map
                          </a>
                        )}
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            </>
          )}

          <div className="events-panel">
            <div className="events-header">
              <div>
                <h2>Event Map Explorer</h2>
                <p>Scout mock Eventbrite & Google Places picks and pin them on the map.</p>
              </div>
              <span className="source-pill">mock data</span>
            </div>
            <form className="event-form" onSubmit={handleEventSearchSubmit}>
              <label>
                Keywords
                <input
                  value={eventQuery}
                  onChange={(e) => setEventQuery(e.target.value)}
                  placeholder="live music, sunset, comedy"
                />
              </label>
              <label>
                Location
                <input
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                  placeholder="City or neighborhood"
                />
              </label>
              <label>
                Vibe filter
                <input
                  value={eventVibeFilter}
                  onChange={(e) => setEventVibeFilter(e.target.value)}
                  placeholder="music, outdoors, cozy"
                />
              </label>
              <label className="event-provider">
                Provider
                <select
                  value={eventProvider}
                  onChange={(e) => setEventProvider(e.target.value as EventProviderOption)}
                >
                  <option value="all">All providers</option>
                  <option value="eventbrite">Eventbrite</option>
                  <option value="google_places">Google Places</option>
                </select>
              </label>
              <button className="secondary" type="submit" disabled={eventsLoading}>
                {eventsLoading ? "Searching..." : "Refresh map"}
              </button>
            </form>
            <div className="map-wrapper">
              {hasMapboxToken ? (
                <div ref={mapContainerRef} className="map-container" />
              ) : (
                <div className="map-placeholder">
                  Add your <code>VITE_MAPBOX_ACCESS_TOKEN</code> to enable the interactive map.
                  Events are still listed below.
                </div>
              )}
            </div>
            <div className="event-results">
              {eventsLoading && <p className="placeholder">Loading events...</p>}
              {eventsError && <div className="error">{eventsError}</div>}
              {!eventsLoading && !eventsError && events.length === 0 && (
                <p className="placeholder">
                  No events matched the current filters. Try adjusting the keywords or location.
                </p>
              )}
              {!eventsLoading && !eventsError && events.length > 0 && (
                <div className="event-cards">
                  {events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`event-card ${activeEventId === event.id ? "event-card--active" : ""}`}
                      onClick={() => handleEventCardClick(event)}
                    >
                      <div className="event-card__content">
                        <h3>{event.title}</h3>
                        <p className="event-card__address">{event.venue ?? event.address ?? "TBA"}</p>
                        <p className="event-card__meta">
                          {event.price ? `Price: ${event.price}` : "Price: —"} ·{" "}
                          <span className="source-pill">{event.source}</span>
                        </p>
                        {event.summary && (
                          <p className="event-card__summary">{event.summary}</p>
                        )}
                      </div>
                      <div className="event-card__links">
                        {event.booking_url && (
                          <a href={event.booking_url} target="_blank" rel="noreferrer">
                            Event
                          </a>
                        )}
                        {event.maps_url && (
                          <a href={event.maps_url} target="_blank" rel="noreferrer">
                            Map
                          </a>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
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

