import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { ActivityResult, invokeAgent, searchActivities } from "./lib/api";

type FormState = {
  query_text: string;
  location?: string;
  budget_cap?: string;
};

const DEFAULT_FORM: FormState = {
  query_text: "Live music with arcade games",
  location: "Boston, MA",
  budget_cap: "",
};

const SUGGESTIONS = [
  "Sip-and-paint night with friends",
  "Open mic comedy downtown",
  "Outdoor skating with food trucks",
  "Late-night board game cafe",
  "Trampoline park party",
];

export default function App() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [activities, setActivities] = useState<ActivityResult[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [agentSummary, setAgentSummary] = useState<string | null>(null);
  const [agentKeywords, setAgentKeywords] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAgentSummary(null);
    setAgentKeywords([]);

    try {
      const budget = form.budget_cap ? Number(form.budget_cap) : undefined;
      const agentPayload = {
        prompt: form.query_text,
        location: form.location || undefined,
        budget_cap: Number.isFinite(budget) ? budget : undefined,
        friends: {
          alex: { likes: ["karaoke", "late night"], budget: 40 },
          maya: { likes: ["arcade", "music"], budget: 35 },
          jordan: { likes: ["outdoors", "food trucks"], budget: 30 },
        },
      };

      let agentActivities: ActivityResult[] = [];
      try {
        const agentResult = await invokeAgent(agentPayload);
        setAgentSummary(agentResult.summary ?? null);
        setAgentKeywords(agentResult.keywords ?? []);
        agentActivities = agentResult.activities ?? [];
      } catch (agentErr) {
        console.warn("Agent invocation failed:", agentErr);
      }

      let results = agentActivities;

      if (!results.length) {
        results = await searchActivities({
          query_text: form.query_text,
          location: form.location || undefined,
          budget_cap: Number.isFinite(budget) ? budget : undefined,
        });
      }

      setActivities(results);
      setSelectedActivity((prev) => (prev && results.some((item) => item.id === prev.id) ? prev : results[0] ?? null));
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setActivities([]);
      setSelectedActivity(null);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedActivity) {
      return;
    }
    if (!activities.some((activity) => activity.id === selectedActivity.id)) {
      setSelectedActivity(null);
    }
  }, [activities, selectedActivity]);

  const topActivities = useMemo(() => activities.slice(0, 40), [activities]);

  function handleSuggestionClick(text: string) {
    setForm((prev) => ({ ...prev, query_text: text }));
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setActivities([]);
    setSelectedActivity(null);
    setError(null);
    setHasSearched(false);
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero__badge">Challo</div>
        <div className="hero__content">
          <h1>Plan the next great hang.</h1>
          <p>
            Describe the vibe, pick a city, and we’ll surface venues, experiences, and nightlife to match the energy.
          </p>
        </div>

        <form className="search-card" onSubmit={handleSubmit}>
          <label className="field">
            <span>What are you in the mood for?</span>
            <textarea
              value={form.query_text}
              onChange={(event) => setForm((prev) => ({ ...prev, query_text: event.target.value }))}
              rows={3}
              placeholder="e.g. Neon-lit arcade with DJ sets"
              required
            />
          </label>

          <div className="search-card__grid">
            <label className="field">
              <span>City or neighborhood</span>
              <input
                value={form.location ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                placeholder="Boston, MA"
              />
            </label>

            <label className="field">
              <span>Budget cap (optional)</span>
              <input
                type="number"
                min="0"
                value={form.budget_cap ?? ""}
                onChange={(event) => setForm((prev) => ({ ...prev, budget_cap: event.target.value }))}
                placeholder="40"
              />
            </label>
          </div>

          <div className="search-card__actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Searching..." : "Discover spots"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={handleReset}>
              Reset
            </button>
          </div>

          <div className="suggestions">
            {SUGGESTIONS.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      </header>

      <main className="app-grid">
        <section className="results-pane">
          <div className="results-header">
            <div>
              <h2>Possible hangouts</h2>
              <p className="muted">
                {loading
                  ? "Fetching your recommendations…"
                  : hasSearched
                  ? "Tap a card to preview it on the map."
                  : "Search to see curated places near you."}
              </p>
            </div>
            {activities.length > 0 && <span className="results-count">{activities.length}</span>}
          </div>

          {agentSummary && (
            <div className="ai-summary">
              <div className="ai-summary__label">AI plan</div>
              <p>{agentSummary}</p>
              {agentKeywords.length > 0 && (
                <div className="ai-summary__keywords">
                  {agentKeywords.map((keyword) => (
                    <span key={keyword} className="tag-chip">
                      {keyword}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && <div className="alert alert--error">{error}</div>}
          {!error && !loading && hasSearched && activities.length === 0 && (
            <div className="empty-state">
              <p>No matches yet. Try broadening the vibe or using a nearby neighborhood.</p>
            </div>
          )}

          <div className="results-list">
            {topActivities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isActive={selectedActivity?.id === activity.id}
                onSelect={() => setSelectedActivity(activity)}
              />
            ))}
            {!loading && !hasSearched && (
              <div className="placeholder-card">
                <p>Need inspiration? Try “late-night karaoke in Chinatown” or “sunset boat ride with cocktails”.</p>
              </div>
            )}
          </div>
        </section>

        <aside className="map-pane">
          {selectedActivity ? (
            <MapPanel activity={selectedActivity} />
          ) : (
            <div className="map-placeholder">
              <h3>Select a spot</h3>
              <p>We’ll drop it on the map with next steps once you choose a card.</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
}

function ActivityCard({
  activity,
  isActive,
  onSelect,
}: {
  activity: ActivityResult;
  isActive: boolean;
  onSelect: () => void;
}) {
  const metaParts: string[] = [];
  if (activity.address) {
    metaParts.push(activity.address);
  }
  if (activity.price) {
    metaParts.push(activity.price);
  }

    return (
    <button type="button" className={`activity-card ${isActive ? "is-active" : ""}`} onClick={onSelect}>
      {activity.image_url ? (
        <div
          className="activity-card__media"
          style={{ backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0) 40%,rgba(15,23,42,0.65)),url(${activity.image_url})` }}
        />
      ) : (
        <div className="activity-card__media activity-card__media--fallback">{activity.title.slice(0, 1)}</div>
      )}

      <div className="activity-card__body">
        <div className="activity-card__head">
          <h3>{activity.title}</h3>
        </div>
        {metaParts.length > 0 && <p className="activity-card__meta">{metaParts.join(" · ")}</p>}
        {activity.summary && <p className="activity-card__summary">{activity.summary}</p>}

        <div className="activity-card__links">
          {activity.booking_url && (
            <a href={activity.booking_url} target="_blank" rel="noreferrer">
              Details
            </a>
          )}
          {activity.maps_url && (
            <a href={activity.maps_url} target="_blank" rel="noreferrer">
              Open in Maps
            </a>
          )}
        </div>
      </div>
    </button>
  );
}

function MapPanel({ activity }: { activity: ActivityResult }) {
  const mapSrc =
    activity.lat != null && activity.lng != null
      ? `https://maps.google.com/maps?q=${activity.lat},${activity.lng}&z=15&output=embed`
      : null;

  return (
    <div className="map-card">
      <div className="map-card__header">
        <div>
          <h3>{activity.title}</h3>
          {activity.address && <p>{activity.address}</p>}
        </div>
        <div className="map-card__actions">
          {activity.booking_url && (
            <a className="btn btn--outline" href={activity.booking_url} target="_blank" rel="noreferrer">
              View details
            </a>
          )}
          {activity.maps_url && (
            <a className="btn btn--primary" href={activity.maps_url} target="_blank" rel="noreferrer">
              Directions
            </a>
          )}
        </div>
      </div>

      {mapSrc ? (
        <iframe title="Selected activity location" src={mapSrc} className="map-card__frame" allowFullScreen loading="lazy" />
      ) : (
        <div className="map-card__fallback">
          <p>Map preview unavailable. Use the links above for directions.</p>
        </div>
      )}

      {activity.tags?.length ? (
        <div className="tag-cloud">
          {activity.tags.slice(0, 6).map((tag) => {
            const label = tag.replace(/_/g, " ");
            return (
              <span key={tag} className="tag-chip">
                {label}
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

