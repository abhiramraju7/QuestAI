import React from "react";
import { ActivityResult } from "../lib/api";

type MatchBreakdown = {
  overall: number;
  prompt: number;
  friends: Array<{
    id: string;
    name: string;
    score: number;
  }>;
};

type ActivityWithMatch = ActivityResult & {
  match: MatchBreakdown;
};

type ActivityPanelProps = {
  activities: ActivityWithMatch[];
  loading: boolean;
  hasSearched: boolean;
  error: string | null;
  selectedActivityId: string | null;
  onSelect: (activity: ActivityWithMatch) => void;
};

export function ActivityPanel({
  activities,
  loading,
  hasSearched,
  error,
  selectedActivityId,
  onSelect,
}: ActivityPanelProps) {
  if (error) {
    return (
      <section className="activity-panel">
        <header className="activity-panel__header">
          <h2>Possible hangouts</h2>
        </header>
        <div className="alert alert--error">{error}</div>
      </section>
    );
  }

  return (
    <section className="activity-panel">
      <header className="activity-panel__header">
        <div>
          <h2>Possible hangouts</h2>
          <p className="muted">
            {loading
              ? "Fetching your recommendations…"
              : hasSearched
              ? "Pick a card to inspect alignment across the crew."
              : "Use the hero form to get agent-curated venues."}
          </p>
        </div>
        {activities.length > 0 && <span className="activity-panel__count">{activities.length}</span>}
      </header>

      <div className="activity-panel__list">
        {activities.map((activity) => (
          <ActivityCard
            key={activity.id}
            activity={activity}
            isActive={selectedActivityId === activity.id}
            onSelect={() => onSelect(activity)}
          />
        ))}

        {!loading && !hasSearched && (
          <div className="activity-panel__placeholder">
            <p>Need inspiration? Try “late-night karaoke in Chinatown” or “sunset boat ride with cocktails”.</p>
          </div>
        )}

        {!loading && hasSearched && activities.length === 0 && (
          <div className="activity-panel__placeholder">
            <p>No matches yet. Try a nearby neighborhood or loosen the vibe.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ActivityCard({
  activity,
  isActive,
  onSelect,
}: {
  activity: ActivityWithMatch;
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

  const overallPercent = Math.round(activity.match.overall * 100);
  const topFriend = [...activity.match.friends].sort((a, b) => b.score - a.score)[0];

  return (
    <button type="button" className={`activity-card ${isActive ? "activity-card--active" : ""}`} onClick={onSelect}>
      {activity.image_url ? (
        <div
          className="activity-card__media"
          style={{
            backgroundImage: `linear-gradient(180deg,rgba(15,23,42,0) 40%,rgba(15,23,42,0.65)),url(${activity.image_url})`,
          }}
        />
      ) : (
        <div className="activity-card__media activity-card__media--fallback">{activity.title.slice(0, 1)}</div>
      )}

      <div className="activity-card__body">
        <header className="activity-card__head">
          <h3>{activity.title}</h3>
        </header>

        {metaParts.length > 0 && <p className="activity-card__meta">{metaParts.join(" · ")}</p>}
        {activity.summary && <p className="activity-card__summary">{activity.summary}</p>}

        <div className="activity-card__match">
          <div className="activity-card__match-bar">
            <span style={{ width: `${overallPercent}%` }} />
          </div>
          <div className="activity-card__match-label">
            <strong>{overallPercent}% match</strong>
            {topFriend ? <span>Best for {topFriend.name}</span> : null}
          </div>
        </div>

        <div className="activity-card__links">
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
      </div>
    </button>
  );
}

