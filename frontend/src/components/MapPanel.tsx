import React from "react";
import type { ActivityWithMatch } from "../App";

type MapPanelProps = {
  activity: ActivityWithMatch | null;
};

export function MapPanel({ activity }: MapPanelProps) {
  if (!activity) {
    return (
      <section className="map-panel map-panel--empty">
        <h3>Select a spot</h3>
        <p>We’ll plot it on the map once you choose an activity.</p>
      </section>
    );
  }

  const mapSrc =
    activity.lat != null && activity.lng != null
      ? `https://maps.google.com/maps?q=${activity.lat},${activity.lng}&z=15&output=embed`
      : null;

  return (
    <section className="map-panel">
      <header className="map-panel__header">
        <div>
          <h3>{activity.title}</h3>
          {activity.address && <p>{activity.address}</p>}
        </div>
        <div className="map-panel__actions">
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
      </header>

      {mapSrc ? (
        <iframe title="Selected activity location" src={mapSrc} className="map-panel__frame" allowFullScreen loading="lazy" />
      ) : (
        <div className="map-panel__fallback">
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
    </section>
  );
}

