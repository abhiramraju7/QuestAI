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
      <LightSurface />
      <SidebarNav />
      <LocationChip
        value={eventLocation}
        onChange={(v) => setEventLocation(v)}
        onSubmit={() => void performEventSearch()}
      />
      <CenterRecommendations
        score={displayScore}
        friends={friendObjects.map((f) => f.name)}
        events={events}
        activeId={activeEventId}
        onEventClick={handleEventCardClick}
        loading={eventsLoading || loading}
      />
      <ChatBar
        value={query}
        onChange={setQuery}
        onSubmit={onSubmit}
        loading={loading}
        placeholder={loading ? "AI is thinking..." : "Describe the vibe, budget, and area..."}
      />
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

function LightSurface() {
  return <div className="yumi-surface" />;
}

function SidebarNav() {
  const items = [
    { label: "Discover", icon: "🧭" },
    { label: "Social Network", icon: "👥" },
    { label: "Friends", icon: "😊" },
    { label: "Explore", icon: "🗺️" },
    { label: "Reservations", icon: "📅" },
    { label: "Profile", icon: "👤" },
  ];
  return (
    <aside className="yumi-sidebar-nav">
      <div className="yumi-brand">YUMI</div>
      <nav>
        {items.map((it, idx) => (
          <button key={it.label} className={`yumi-nav-item ${idx === 0 ? "is-active" : ""}`} type="button">
            <span className="yumi-nav-icon">{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </nav>
      <div className="yumi-nav-footer">
        <button type="button" className="yumi-nav-item">
          <span className="yumi-nav-icon">🔇</span>
          <span>Mute</span>
        </button>
        <button type="button" className="yumi-logout">Logout</button>
      </div>
    </aside>
  );
}

function LocationChip({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="yumi-location">
      <input
        className="yumi-location__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <span className="yumi-caret">⌄</span>
    </div>
  );
}

function CenterRecommendations({
  score,
  friends,
  events,
  activeId,
  onEventClick,
  loading,
}: {
  score: number;
  friends: string[];
  events: EventItem[];
  activeId: string | null;
  onEventClick: (e: EventItem) => void;
  loading: boolean;
}) {
  const topEvents = useMemo(() => events.slice(0, 12), [events]);
  return (
    <section className="yumi-center">
      <SimilarityOrb score={score} friends={friends} />
      <div className="yumi-orbit-cards">
        {topEvents.map((e, i) => {
          const angle = (i / Math.max(1, topEvents.length)) * 360;
          const transform = `rotate(${angle}deg) translateY(-15rem) rotate(${-angle}deg)`;
          const active = activeId === e.id;
          return (
            <button
              key={e.id}
              type="button"
              className={`yumi-card ${active ? "is-active" : ""}`}
              style={{ transform }}
              onClick={() => onEventClick(e)}
              title={e.title}
            >
              <div className="yumi-card__thumb" aria-hidden="true">
                <span>{e.title.slice(0, 1)}</span>
              </div>
              <span className="yumi-card__title">{e.title}</span>
            </button>
          );
        })}
      </div>
      {loading && <div className="yumi-loading">Finalizing recommendations</div>}
    </section>
  );
}

function ChatBar({
  value,
  onChange,
  onSubmit,
  loading,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  placeholder?: string;
}) {
  return (
    <form className="yumi-chatbar" onSubmit={onSubmit}>
      <button type="button" className="yumi-chatbar__icon" aria-label="Attachments">📎</button>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "AI is thinking..."}
      />
      <button className="yumi-send" disabled={loading} aria-label="Send">
        ➤
      </button>
    </form>
  );
}

type YumiLayoutProps = {
  query: string;
  setQuery: (v: string) => void;
  locationHint: string;
  setLocationHint: (v: string) => void;
  timeWindow: string;
  setTimeWindow: (v: string) => void;
  vibeHint: string;
  setVibeHint: (v: string) => void;
  customLikes: string;
  setCustomLikes: (v: string) => void;
  customTags: string;
  setCustomTags: (v: string) => void;
  selectedFriends: string[];
  toggleFriend: (id: string) => void;
  friends: typeof FRIENDS;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  loading: boolean;
  events: EventItem[];
  eventsLoading: boolean;
  eventsError: string | null;
  setEventQuery: (v: string) => void;
  setEventLocation: (v: string) => void;
  setEventVibeFilter: (v: string) => void;
  handleEventSearchSubmit: (e: FormEvent<HTMLFormElement>) => void;
  result: PlanResponse | null;
  displayScore: number;
  onEventClick: (event: EventItem) => void;
};

function YumiLayout(props: YumiLayoutProps) {
  const {
    query,
    setQuery,
    locationHint,
    setLocationHint,
    timeWindow,
    setTimeWindow,
    vibeHint,
    setVibeHint,
    customLikes,
    setCustomLikes,
    customTags,
    setCustomTags,
    selectedFriends,
    toggleFriend,
    friends,
    onSubmit,
    loading,
    events,
    eventsLoading,
    eventsError,
    setEventQuery,
    setEventLocation,
    setEventVibeFilter,
    handleEventSearchSubmit,
    result,
    displayScore,
    onEventClick,
  } = props;

  const defaultHobbies = useMemo(
    () => [
      "live music",
      "board games",
      "hiking",
      "coffee tasting",
      "museum",
      "karaoke",
      "photography",
      "yoga",
      "coding jam",
      "kayaking",
      "escape room",
      "arcade",
    ],
    []
  );

  const initialSelected = useMemo(() => splitList(customLikes).slice(0, 6), [customLikes]);
  const [plateSelected, setPlateSelected] = useState<string[]>(initialSelected);

  useEffect(() => {
    setCustomLikes(plateSelected.join(", "));
  }, [plateSelected, setCustomLikes]);

  const suggestionSet = useMemo(() => {
    const extra = [
      ...splitList(customTags),
      ...friends.flatMap((f) => splitList(f.defaultLikes ?? "")),
    ];
    return Array.from(new Set([...defaultHobbies, ...extra])).slice(0, 24);
  }, [customTags, defaultHobbies, friends]);

  const friendNames = friends
    .filter((f) => selectedFriends.includes(f.id))
    .map((f) => f.name);

  return (
    <div className="yumi-layout">
      <aside className="yumi-sidebar panel">
        <header className="yumi-section-header">
          <h3>Hobby Plate</h3>
          <small>Pick up to 6 hobbies</small>
        </header>
        <HobbyPlate
          selected={plateSelected}
          onToggle={(tag) =>
            setPlateSelected((prev) =>
              prev.includes(tag) ? prev.filter((t) => t !== tag) : prev.length < 6 ? [...prev, tag] : prev
            )
          }
        />
        <div className="chip-cloud">
          {suggestionSet.map((tag) => {
            const active = plateSelected.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                className={`chip ${active ? "chip--active" : ""}`}
                onClick={() =>
                  setPlateSelected((prev) =>
                    prev.includes(tag)
                      ? prev.filter((t) => t !== tag)
                      : prev.length < 6
                      ? [...prev, tag]
                      : prev
                  )
                }
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="yumi-subsection">
          <h4>Friends</h4>
          <div className="friend-chips">
            {friends.map((friend) => {
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
        </div>
      </aside>

      <main className="yumi-main">
        <form className="yumi-search panel" onSubmit={onSubmit}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What vibe are you going for? e.g., outdoorsy music near Cambridge under $20"
          />
          <div className="search-row">
            <input
              value={locationHint}
              onChange={(e) => setLocationHint(e.target.value)}
              placeholder="Location"
            />
            <input
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              placeholder="Time window"
            />
            <input
              value={vibeHint}
              onChange={(e) => setVibeHint(e.target.value)}
              placeholder="Vibe (optional)"
            />
            <button className="primary" type="submit" disabled={loading}>
              {loading ? "Curating..." : "Explore Activities"}
            </button>
          </div>
        </form>

        <section className="panel">
          <header className="yumi-section-header">
            <h3>Activity Places</h3>
            <small>From Eventbrite and Google Places</small>
          </header>

          <form className="yumi-event-filters" onSubmit={handleEventSearchSubmit}>
            <input onChange={(e) => setEventQuery(e.target.value)} placeholder="Keyword" />
            <input onChange={(e) => setEventLocation(e.target.value)} placeholder="Location" />
            <input onChange={(e) => setEventVibeFilter(e.target.value)} placeholder="Vibe" />
            <button type="submit" disabled={eventsLoading}>
              {eventsLoading ? "..." : "Refresh"}
            </button>
          </form>

          {eventsError && <div className="inline-error">{eventsError}</div>}
          {!eventsError && eventsLoading && <p className="placeholder">Loading events...</p>}
          {!eventsError && !eventsLoading && events.length === 0 && (
            <p className="placeholder">No events matched. Try new keywords.</p>
          )}

          <ActivityGrid events={events} onClick={onEventClick} />
        </section>
      </main>

      <aside className="yumi-rightbar">
        <div className="panel yumi-orb">
          <SimilarityOrb score={displayScore} friends={friendNames} />
        </div>

        <div className="panel">
          <header className="yumi-section-header">
            <h3>Curated Plan</h3>
            <small>Best-fit picks for your group</small>
          </header>
          {!result && <p className="placeholder">Run a search to see curated picks.</p>}
          {result && (
            <ul className="plan-grid">
              {result.candidates.map((card) => (
                <li key={card.title} className="plan-card">
                  <div className="plan-card__head">
                    <strong>{card.title}</strong>
                    <span className="score">{Math.round(card.group_score * 100)}%</span>
                  </div>
                  <p className="plan-card__meta">
                    {card.price ? card.price : "—"} ·{" "}
                    {card.distance_km ? `${card.distance_km} km` : "distance unknown"} ·{" "}
                    <span className="source-pill">{card.source}</span>
                  </p>
                  {card.summary && <p className="summary-text">{card.summary}</p>}
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function HobbyPlate({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  const slots = Array.from({ length: 6 });
  return (
    <div className="hobby-plate">
      <div className="plate-base" />
      {slots.map((_, i) => {
        const tag = selected[i];
        const angle = (i / slots.length) * 360;
        const transform = `translate(-50%, -50%) rotate(${angle}deg) translateY(-80px) rotate(${-angle}deg)`;
        return (
          <button
            key={i}
            type="button"
            className={`plate-slot ${tag ? "plate-slot--filled" : ""}`}
            style={{ transform }}
            onClick={() => tag && onToggle(tag)}
            title={tag || "Empty slot"}
          >
            <span>{tag ? tag : "+"}</span>
          </button>
        );
      })}
    </div>
  );
}

function ActivityGrid({
  events,
  onClick,
}: {
  events: EventItem[];
  onClick: (event: EventItem) => void;
}) {
  return (
    <div className="activity-grid">
      {events.map((e) => (
        <button key={e.id} type="button" className="activity-card" onClick={() => onClick(e)}>
          <div className="activity-card__head">
            <span className="activity-title">{e.title}</span>
            <span className="source-pill">{e.source}</span>
          </div>
          <span className="activity-meta">{e.venue ?? e.address ?? "TBA"} · {e.price ?? "—"}</span>
          {e.vibes?.length ? (
            <div className="tag-chip-row">
              {e.vibes.slice(0, 3).map((v) => (
                <span className="tag-chip" key={v}>
                  {v}
                </span>
              ))}
            </div>
          ) : null}
        </button>
      ))}
    </div>
  );
}

