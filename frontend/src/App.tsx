import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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

type FriendConfig = {
  id: string;
  name: string;
  tags: string[];
  defaultLikes?: string;
  defaultVibes?: string;
};

const FRIENDS: FriendConfig[] = [
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

const INITIAL_SELECTED_FRIENDS = FRIENDS.slice(0, 2).map((friend) => friend.id);

type FriendInputState = {
  likes: string;
  vibes: string;
  tags: string;
  budget: string;
  distance: string;
};

type LastContext = {
  location: string;
  time: string;
  vibeHint?: string;
  budget?: number;
  distance?: number;
  likes: string[];
  tags: string[];
};

type EventProviderOption = "all" | "eventbrite" | "google_places";

const splitList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const buildInitialFriendInputs = (): Record<string, FriendInputState> => {
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
};

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

  const [selectedFriends, setSelectedFriends] = useState<string[]>(INITIAL_SELECTED_FRIENDS);
  const [activeFriendId, setActiveFriendId] = useState<string | null>(INITIAL_SELECTED_FRIENDS[0] ?? null);
  const [friendInputs, setFriendInputs] = useState<Record<string, FriendInputState>>(buildInitialFriendInputs);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [lastContext, setLastContext] = useState<LastContext | null>(null);

  const [eventQuery, setEventQuery] = useState("live music");
  const [eventLocation, setEventLocation] = useState("Cambridge, MA");
  const [eventVibeFilter, setEventVibeFilter] = useState("music");
  const [eventProvider, setEventProvider] = useState<EventProviderOption>("all");
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);

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
      setActiveEventId(data.length > 0 ? data[0].id : null);
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
    if (activeFriendId && !selectedFriends.includes(activeFriendId)) {
      setActiveFriendId(selectedFriends[0] ?? null);
    }
  }, [activeFriendId, selectedFriends]);

  const handleFriendInputChange = useCallback(
    (id: string, field: keyof FriendInputState, value: string) => {
      setFriendInputs((prev) => ({
        ...prev,
        [id]: {
          ...(prev[id] ?? { likes: "", vibes: "", tags: "", budget: "", distance: "" }),
          [field]: value,
        },
      }));
    },
    []
  );

  const handlePlanSubmit = useCallback(
    async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      setResult(null);
      setLastContext(null);

      try {
        const likesArray = splitList(customLikes);
        const tagsArray = splitList(customTags);

        const friendOverrides = selectedFriends.map((id) => {
          const inputs = friendInputs[id] ?? { likes: "", vibes: "", tags: "", budget: "", distance: "" };
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
    },
    [
      budgetCap,
      customLikes,
      customTags,
      distanceKm,
      friendInputs,
      locationHint,
      query,
      selectedFriends,
      timeWindow,
      vibeHint,
    ]
  );

  const handleEventSearchSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      void performEventSearch();
    },
    [performEventSearch]
  );

  const handleEventCardClick = useCallback((event: EventItem) => {
    setActiveEventId(event.id);
  }, []);

  const toggleFriend = useCallback(
    (id: string) => {
      setSelectedFriends((prev) => {
        const exists = prev.includes(id);
        if (exists) {
          const next = prev.filter((friendId) => friendId !== id);
          if (activeFriendId === id) {
            setActiveFriendId(next[0] ?? null);
          }
          return next;
        }
        setActiveFriendId(id);
        return [...prev, id];
      });
    },
    [activeFriendId]
  );

  const activeEvent = useMemo(
    () => events.find((event) => event.id === activeEventId) ?? null,
    [events, activeEventId]
  );

  const topScore = result?.candidates?.length
    ? Math.max(...result.candidates.map((candidate) => candidate.group_score))
    : null;
  const displayScore = topScore ? Math.round(topScore * 100) : 62;

  const friendObjects = useMemo(
    () => FRIENDS.filter((friend) => selectedFriends.includes(friend.id)),
    [selectedFriends]
  );

  return (
    <div className="app-shell">
      <div className="app-surface" />
      <div className="layout">
        <header className="app-header">
          <div className="app-header__copy">
            <h1>Challo Group Planner</h1>
            <p>Blend everyone’s interests and surface the smartest picks from Eventbrite and Google Places.</p>
          </div>
          <div className="header-actions">
            <LocationChip value={eventLocation} onChange={setEventLocation} onSubmit={() => void performEventSearch()} />
            <div className="header-card">
              <span>Active friends</span>
              <strong>{selectedFriends.length}</strong>
            </div>
          </div>
        </header>

        <div className="content-grid">
          <div className="column column--left">
            <Panel title="Group Brief" subtitle="Tell us what the crew is craving right now.">
              <GroupForm
                query={query}
                locationHint={locationHint}
                timeWindow={timeWindow}
                vibeHint={vibeHint}
                budgetCap={budgetCap}
                distanceKm={distanceKm}
                customLikes={customLikes}
                customTags={customTags}
                setQuery={setQuery}
                setLocationHint={setLocationHint}
                setTimeWindow={setTimeWindow}
                setVibeHint={setVibeHint}
                setBudgetCap={setBudgetCap}
                setDistanceKm={setDistanceKm}
                setCustomLikes={setCustomLikes}
                setCustomTags={setCustomTags}
                loading={loading}
                error={error}
                onSubmit={handlePlanSubmit}
                lastContext={lastContext}
              />
            </Panel>

            <Panel title="Friend Overrides" subtitle="Toggle who’s joining and fine-tune their interests.">
              <FriendPreferences
                friends={FRIENDS}
                selectedFriends={selectedFriends}
                activeFriendId={activeFriendId}
                onSelectFriend={setActiveFriendId}
                onToggleFriend={toggleFriend}
                friendInputs={friendInputs}
                onFriendFieldChange={handleFriendInputChange}
              />
            </Panel>
          </div>

          <div className="column column--center">
            <Panel title="Live Activities" subtitle="Instant feed from Eventbrite and Google Places.">
              <EventPanel
                eventQuery={eventQuery}
                eventLocation={eventLocation}
                eventVibeFilter={eventVibeFilter}
                eventProvider={eventProvider}
                setEventQuery={setEventQuery}
                setEventLocation={setEventLocation}
                setEventVibeFilter={setEventVibeFilter}
                setEventProvider={setEventProvider}
                customLikes={customLikes}
                customTags={customTags}
                onSubmit={handleEventSearchSubmit}
                events={events}
                eventsLoading={eventsLoading}
                eventsError={eventsError}
                activeEventId={activeEventId}
                onSelectEvent={handleEventCardClick}
              />
            </Panel>
          </div>

          <div className="column column--right">
            <Panel title="Match Summary" subtitle="Your best-fit pick right now.">
              <MatchSummary score={displayScore} friends={friendObjects.map((f) => f.name)} event={activeEvent} />
            </Panel>

            <Panel title="Curated Plan" subtitle="Top ranked ideas generated for your group.">
              <PlanPanel result={result} loading={loading} />
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

type PanelProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

function Panel({ title, subtitle, action, children }: PanelProps) {
  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action ? <div className="panel__action">{action}</div> : null}
      </div>
      <div className="panel__body">{children}</div>
    </section>
  );
}

type GroupFormProps = {
  query: string;
  locationHint: string;
  timeWindow: string;
  vibeHint: string;
  budgetCap: string;
  distanceKm: string;
  customLikes: string;
  customTags: string;
  setQuery: (value: string) => void;
  setLocationHint: (value: string) => void;
  setTimeWindow: (value: string) => void;
  setVibeHint: (value: string) => void;
  setBudgetCap: (value: string) => void;
  setDistanceKm: (value: string) => void;
  setCustomLikes: (value: string) => void;
  setCustomTags: (value: string) => void;
  loading: boolean;
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  lastContext: LastContext | null;
};

function GroupForm({
  query,
  locationHint,
  timeWindow,
  vibeHint,
  budgetCap,
  distanceKm,
  customLikes,
  customTags,
  setQuery,
  setLocationHint,
  setTimeWindow,
  setVibeHint,
  setBudgetCap,
  setDistanceKm,
  setCustomLikes,
  setCustomTags,
  loading,
  error,
  onSubmit,
  lastContext,
}: GroupFormProps) {
  return (
    <form className="group-form" onSubmit={onSubmit}>
      {error && <div className="inline-error">{error}</div>}
      <div className="field">
        <label htmlFor="group-query">What are you in the mood for?</label>
        <textarea
          id="group-query"
          value={query}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setQuery(e.target.value)}
          placeholder="e.g. Outdoor hangs under $25 with live music after sunset."
          rows={4}
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="group-location">Location</label>
          <input
            id="group-location"
            value={locationHint}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLocationHint(e.target.value)}
            placeholder="City or neighborhood"
          />
        </div>
        <div className="field">
          <label htmlFor="group-time">Time window</label>
          <input
            id="group-time"
            value={timeWindow}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTimeWindow(e.target.value)}
            placeholder="Tonight 6-10pm"
          />
        </div>
        <div className="field">
          <label htmlFor="group-vibe">Vibe (optional)</label>
          <input
            id="group-vibe"
            value={vibeHint}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVibeHint(e.target.value)}
            placeholder="e.g. outdoors, live music"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="group-budget">Budget cap ($)</label>
          <input
            id="group-budget"
            type="number"
            min="0"
            value={budgetCap}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBudgetCap(e.target.value)}
            placeholder="20"
          />
        </div>
        <div className="field">
          <label htmlFor="group-distance">Distance (km)</label>
          <input
            id="group-distance"
            type="number"
            min="0"
            value={distanceKm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDistanceKm(e.target.value)}
            placeholder="5"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor="group-likes">Shared likes</label>
        <input
          id="group-likes"
          value={customLikes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomLikes(e.target.value)}
          placeholder="Comma separated e.g. live music, rooftops, art walk"
        />
        <small>Use commas to separate interests.</small>
      </div>

      <div className="field">
        <label htmlFor="group-tags">Must-haves & constraints</label>
        <input
          id="group-tags"
          value={customTags}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCustomTags(e.target.value)}
          placeholder="Comma separated e.g. outdoor, dog friendly, budget"
        />
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? "Curating plan…" : "Generate plan"}
        </button>
      </div>

      {lastContext && (
        <div className="form-context">
          <span className="form-context__label">Last run</span>
          <div className="chip-row">
            <ContextChip label={`${lastContext.location}`} />
            <ContextChip label={`${lastContext.time}`} />
            {lastContext.vibeHint ? <ContextChip label={lastContext.vibeHint} /> : null}
            {lastContext.budget ? <ContextChip label={`≤ $${lastContext.budget}`} tone="neutral" /> : null}
            {lastContext.distance ? <ContextChip label={`≤ ${lastContext.distance} km`} tone="neutral" /> : null}
          </div>
        </div>
      )}
    </form>
  );
}

type FriendPreferencesProps = {
  friends: FriendConfig[];
  selectedFriends: string[];
  activeFriendId: string | null;
  onSelectFriend: (id: string | null) => void;
  onToggleFriend: (id: string) => void;
  friendInputs: Record<string, FriendInputState>;
  onFriendFieldChange: (id: string, field: keyof FriendInputState, value: string) => void;
};

function FriendPreferences({
  friends,
  selectedFriends,
  activeFriendId,
  onSelectFriend,
  onToggleFriend,
  friendInputs,
  onFriendFieldChange,
}: FriendPreferencesProps) {
  const activeFriend = friends.find((friend) => friend.id === activeFriendId) ?? null;

  return (
    <div className="friend-preferences">
      <div className="friend-preferences__chips">
        {friends.map((friend) => {
          const isSelected = selectedFriends.includes(friend.id);
          const isActive = activeFriendId === friend.id;
          const initials = friend.name
            .split(" ")
            .map((s) => s[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          return (
            <button
              key={friend.id}
              type="button"
              className={`friend-chip ${isSelected ? "friend-chip--selected" : ""} ${
                isActive ? "friend-chip--active" : ""
              }`}
              onClick={() => {
                if (!isSelected) {
                  onToggleFriend(friend.id);
                }
                onSelectFriend(friend.id);
              }}
            >
              <span className="friend-chip__avatar">{initials}</span>
              <span className="friend-chip__content">
                <strong>{friend.name}</strong>
                <small>{friend.tags.join(" • ")}</small>
              </span>
              <span className="friend-chip__status">{isSelected ? "Included" : "Tap to include"}</span>
            </button>
          );
        })}
      </div>

      {!selectedFriends.length && <p className="empty-state">Pick at least one friend to build a plan.</p>}

      {activeFriend && selectedFriends.includes(activeFriend.id) && (
        <div className="friend-editor">
          <div className="friend-editor__header">
            <div>
              <h4>{activeFriend.name}</h4>
              <small>Edit overrides to personalize the plan.</small>
            </div>
            <button type="button" className="btn btn-tonal" onClick={() => onToggleFriend(activeFriend.id)}>
              Remove
            </button>
          </div>
          <div className="friend-editor__grid">
            <label className="field">
              <span>Likes</span>
              <input
                value={friendInputs[activeFriend.id]?.likes ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onFriendFieldChange(activeFriend.id, "likes", e.target.value)
                }
                placeholder={activeFriend.defaultLikes ?? "Comma separated e.g. escape rooms"}
              />
            </label>
            <label className="field">
              <span>Vibes</span>
              <input
                value={friendInputs[activeFriend.id]?.vibes ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onFriendFieldChange(activeFriend.id, "vibes", e.target.value)
                }
                placeholder={activeFriend.defaultVibes ?? "Comma separated e.g. cozy"}
              />
            </label>
            <label className="field">
              <span>Tags</span>
              <input
                value={friendInputs[activeFriend.id]?.tags ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onFriendFieldChange(activeFriend.id, "tags", e.target.value)
                }
                placeholder={activeFriend.tags.join(", ")}
              />
            </label>
            <label className="field">
              <span>Budget max ($)</span>
              <input
                type="number"
                min="0"
                value={friendInputs[activeFriend.id]?.budget ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onFriendFieldChange(activeFriend.id, "budget", e.target.value)
                }
                placeholder="Optional"
              />
            </label>
            <label className="field">
              <span>Distance max (km)</span>
              <input
                type="number"
                min="0"
                value={friendInputs[activeFriend.id]?.distance ?? ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onFriendFieldChange(activeFriend.id, "distance", e.target.value)
                }
                placeholder="Optional"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

type EventPanelProps = {
  eventQuery: string;
  eventLocation: string;
  eventVibeFilter: string;
  eventProvider: EventProviderOption;
  setEventQuery: (value: string) => void;
  setEventLocation: (value: string) => void;
  setEventVibeFilter: (value: string) => void;
  setEventProvider: (value: EventProviderOption) => void;
  customLikes: string;
  customTags: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  events: EventItem[];
  eventsLoading: boolean;
  eventsError: string | null;
  activeEventId: string | null;
  onSelectEvent: (event: EventItem) => void;
};

function EventPanel({
  eventQuery,
  eventLocation,
  eventVibeFilter,
  eventProvider,
  setEventQuery,
  setEventLocation,
  setEventVibeFilter,
  setEventProvider,
  customLikes,
  customTags,
  onSubmit,
  events,
  eventsLoading,
  eventsError,
  activeEventId,
  onSelectEvent,
}: EventPanelProps) {
  const likesPreview = splitList(customLikes).slice(0, 4);
  const tagsPreview = splitList(customTags).slice(0, 4);

  return (
    <div className="event-panel">
      <form className="event-filters" onSubmit={onSubmit}>
        <input
          value={eventQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventQuery(e.target.value)}
          placeholder="Keyword or vibe"
        />
        <input
          value={eventLocation}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventLocation(e.target.value)}
          placeholder="Search location"
        />
        <input
          value={eventVibeFilter}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEventVibeFilter(e.target.value)}
          placeholder="Filter by vibe"
        />
        <select
          value={eventProvider}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setEventProvider(e.target.value as EventProviderOption)
          }
        >
          <option value="all">All providers</option>
          <option value="eventbrite">Eventbrite</option>
          <option value="google_places">Google Places</option>
        </select>
        <button className="btn btn-tonal" type="submit" disabled={eventsLoading}>
          {eventsLoading ? "Searching…" : "Refresh"}
        </button>
      </form>

      {(likesPreview.length > 0 || tagsPreview.length > 0) && (
        <div className="chip-row">
          {likesPreview.map((like) => (
            <ContextChip key={`like-${like}`} label={like} />
          ))}
          {tagsPreview.map((tag) => (
            <ContextChip key={`tag-${tag}`} label={tag} tone="neutral" />
          ))}
        </div>
      )}

      {eventsError && <div className="inline-error">{eventsError}</div>}
      {!eventsError && eventsLoading && <p className="empty-state">Loading activities…</p>}
      {!eventsError && !eventsLoading && events.length === 0 && (
        <p className="empty-state">No activities matched. Try adjusting your filters.</p>
      )}

      <div className="event-list">
        {events.map((event) => (
          <EventCard key={event.id} event={event} active={activeEventId === event.id} onSelect={onSelectEvent} />
        ))}
      </div>
    </div>
  );
}

type EventCardProps = {
  event: EventItem;
  active: boolean;
  onSelect: (event: EventItem) => void;
};

function EventCard({ event, active, onSelect }: EventCardProps) {
  const metaParts: string[] = [];
  if (event.price) metaParts.push(event.price);
  if (event.venue) {
    metaParts.push(event.venue);
  } else if (event.address) {
    metaParts.push(event.address);
  }
  if (event.vibe) metaParts.push(event.vibe);

  return (
    <button
      type="button"
      className={`event-card ${active ? "event-card--active" : ""}`}
      onClick={() => onSelect(event)}
      aria-pressed={active}
    >
      <div className="event-card__header">
        <span className="source-pill">{event.source}</span>
        {event.booking_url && (
          <a href={event.booking_url} target="_blank" rel="noreferrer">
            View
          </a>
        )}
      </div>
      <h3>{event.title}</h3>
      {metaParts.length > 0 && <p className="event-card__meta">{metaParts.join(" · ")}</p>}
      {event.summary && <p className="event-card__summary">{event.summary}</p>}
      {event.maps_url && (
        <div className="event-card__footer">
          <a href={event.maps_url} target="_blank" rel="noreferrer">
            Map
          </a>
        </div>
      )}
    </button>
  );
}

type MatchSummaryProps = {
  score: number;
  friends: string[];
  event: EventItem | null;
};

function MatchSummary({ score, friends, event }: MatchSummaryProps) {
  return (
    <div className="match-card">
      <ScoreMeter score={score} />
      <div className="match-card__friends">
        {friends.length > 0 ? (
          friends.map((name) => <FriendBadge key={name} name={name} />)
        ) : (
          <p className="empty-state">Add friends to personalize the match.</p>
        )}
      </div>
      <EventDetail event={event} />
    </div>
  );
}

function FriendBadge({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="friend-badge" title={name}>
      {initials}
    </span>
  );
}

function ScoreMeter({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const angle = (clamped / 100) * 360;
  return (
    <div className="score-meter" style={{ ["--score-angle" as any]: `${angle}deg` }}>
      <div className="score-meter__ring" />
      <div className="score-meter__inner">
        <span className="score-meter__value">{clamped}%</span>
        <span className="score-meter__caption">Group match</span>
      </div>
    </div>
  );
}

function EventDetail({ event }: { event: EventItem | null }) {
  if (!event) {
    return <p className="empty-state">Select an activity to see more details.</p>;
  }

  return (
    <div className="event-detail">
      <div className="event-detail__title">
        <h4>{event.title}</h4>
        <span className="source-pill">{event.source}</span>
      </div>
      {(event.venue || event.address || event.price) && (
        <p className="event-detail__meta">
          {[event.venue || event.address, event.price].filter(Boolean).join(" · ")}
        </p>
      )}
      {event.summary && <p className="event-detail__summary">{event.summary}</p>}
      <div className="link-row">
        {event.booking_url && (
          <a href={event.booking_url} target="_blank" rel="noreferrer">
            Event details
          </a>
        )}
        {event.maps_url && (
          <a href={event.maps_url} target="_blank" rel="noreferrer">
            Open map
          </a>
        )}
      </div>
    </div>
  );
}

function PlanPanel({ result, loading }: { result: PlanResponse | null; loading: boolean }) {
  if (loading && !result) {
    return <p className="empty-state">Generating plan…</p>;
  }

  if (!result || result.candidates.length === 0) {
    return <p className="empty-state">Generate a plan to see curated suggestions.</p>;
  }

  return (
    <div className="plan-panel">
      <ul className="plan-list">
        {result.candidates.map((card) => {
          const distanceLabel =
            typeof card.distance_km === "number" ? `${card.distance_km.toFixed(1)} km` : null;
          return (
            <li key={`${card.title}-${card.source}`} className="plan-item">
              <div className="plan-item__header">
                <h4>{card.title}</h4>
                <span className="plan-item__score">{Math.round(card.group_score * 100)}%</span>
              </div>
              <div className="plan-item__meta">
                {card.vibe && <ContextChip label={card.vibe} />}
                {card.price && <ContextChip label={card.price} tone="neutral" />}
                {distanceLabel ? <ContextChip label={distanceLabel} tone="neutral" /> : null}
                <ContextChip label={card.source} tone="soft" />
              </div>
              {card.summary && <p className="plan-item__summary">{card.summary}</p>}
              {card.reasons?.length ? (
                <ul className="bullet-list">
                  {card.reasons.map((reason, idx) => (
                    <li key={`${card.title}-reason-${idx}`}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              <div className="plan-item__footer">
                {card.booking_url && (
                  <a href={card.booking_url} target="_blank" rel="noreferrer">
                    Details
                  </a>
                )}
                {card.maps_url && (
                  <a href={card.maps_url} target="_blank" rel="noreferrer">
                    Map
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {result.action_log?.length ? (
        <div className="action-log">
          {result.action_log.map((entry, idx) => (
            <span key={`log-${idx}`}>{entry}</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function LocationChip({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="location-chip">
      <span className="location-chip__icon">📍</span>
      <input
        className="location-chip__input"
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          }
        }}
        aria-label="Update event search location"
      />
      <button type="button" className="location-chip__button" onClick={onSubmit}>
        Update
      </button>
    </div>
  );
}

function ContextChip({ label, tone = "primary" }: { label: string; tone?: "primary" | "neutral" | "soft" }) {
  return <span className={`context-chip context-chip--${tone}`}>{label}</span>;
}

