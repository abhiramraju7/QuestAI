import React, { FormEvent, useEffect, useState } from "react";
import { ActivityResult, searchActivities } from "./lib/api";

type FormState = {
  query_text: string;
  location?: string;
  budget_cap?: string;
};

export default function App() {
  const [form, setForm] = useState<FormState>({
    query_text: "Live music with food trucks",
    location: "Cambridge, MA",
    budget_cap: "30",
  });
  const [activities, setActivities] = useState<ActivityResult[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const budget = form.budget_cap ? Number(form.budget_cap) : undefined;
      const results = await searchActivities({
        query_text: form.query_text,
        location: form.location || undefined,
        budget_cap: Number.isFinite(budget) ? budget : undefined,
      });
      setActivities(results);
      setSelectedActivity(results[0] ?? null);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setActivities([]);
      setSelectedActivity(null);
      setHasSearched(true);
  useEffect(() => {
    if (activities.length > 0) {
      setSelectedActivity((prev) => prev ?? activities[0]);
    } else {
      setSelectedActivity(null);
    }
  }, [activities]);

    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <header className="page__header">
        <h1>Challo Activity Finder</h1>
        <p>Give us a vibe, city, or budget and we’ll pull live matches from Eventbrite and Google Places.</p>
      </header>

      <main className="page__main">
        <section className="panel">
          <form className="search-form" onSubmit={handleSubmit}>
            <label className="field">
              <span>What are you looking for?</span>
              <textarea
                value={form.query_text}
                onChange={(event) => setForm((prev) => ({ ...prev, query_text: event.target.value }))}
                rows={3}
                placeholder="e.g. Chill rooftop hangs with live jazz"
                required
              />
            </label>

            <div className="form-grid">
              <label className="field">
                <span>Location (optional)</span>
                <input
                  value={form.location ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
                  placeholder="City, neighborhood, or address"
                />
              </label>

              <label className="field">
                <span>Budget cap (optional)</span>
                <input
                  type="number"
                  min="0"
                  value={form.budget_cap ?? ""}
                  onChange={(event) => setForm((prev) => ({ ...prev, budget_cap: event.target.value }))}
                  placeholder="30"
                />
              </label>
            </div>

            <button type="submit" className="btn" disabled={loading}>
              {loading ? "Searching..." : "Find activities"}
            </button>
          </form>
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>Results</h2>
            {activities.length > 0 && <span className="badge">{activities.length}</span>}
          </header>

          {error && <div className="alert alert--error">{error}</div>}
          {!error && loading && <p className="muted">Fetching live options…</p>}
          {!error && !loading && activities.length === 0 && hasSearched && (
            <p className="muted">No activities matched. Try adjusting your search.</p>
          )}
          {!error && !loading && !hasSearched && (
            <p className="muted">Run a search to see Eventbrite and Google Places recommendations.</p>
          )}

          <ul className="results">
            {activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                isActive={selectedActivity?.id === activity.id}
                onSelect={() => setSelectedActivity(activity)}
              />
            ))}
          </ul>
        </section>

        <section className="panel">
          <header className="panel__header">
            <h2>Map</h2>
          </header>
          {selectedActivity ? (
            <div className="map-panel">
              <div className="map-panel__meta">
                <strong>{selectedActivity.title}</strong>
                <p>{selectedActivity.address ?? "Location coming soon"}</p>
              </div>
              {selectedActivity.lat != null && selectedActivity.lng != null ? (
                <iframe
                  title="Activity location"
                  className="map-frame"
                  src={`https://maps.google.com/maps?q=${selectedActivity.lat},${selectedActivity.lng}&z=15&output=embed`}
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <p className="muted">No coordinates available for this spot.</p>
              )}
            </div>
          ) : (
            <p className="muted">Select an activity to preview it on the map.</p>
          )}
        </section>
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
  return (
    <li>
      <button type="button" className={`result-card ${isActive ? "result-card--active" : ""}`} onClick={onSelect}>
      <header className="result-card__head">
        <h3>{activity.title}</h3>
        <span className={`tag tag--${activity.source}`}>{activity.source}</span>
      </header>

      <p className="result-card__meta">
        {[activity.price ?? "Price unknown", activity.address ?? "Location TBD"].filter(Boolean).join(" · ")}
      </p>

      {activity.summary && <p className="result-card__summary">{activity.summary}</p>}

      <div className="result-card__links">
        {activity.booking_url && (
          <a href={activity.booking_url} target="_blank" rel="noreferrer">
            Details
          </a>
        )}
        {activity.maps_url && (
          <a href={activity.maps_url} target="_blank" rel="noreferrer">
            Map
          </a>
        )}
      </div>
      </button>
    </li>
  );
}

