import React from "react";
import { ActivityResult } from "../lib/api";

type OrbitCarouselProps = {
  activities: ActivityResult[];
  selectedActivityId: string | null;
  loading: boolean;
  onSelect: (activity: ActivityResult) => void;
};

const MAX_ORBIT_ITEMS = 8;

export function OrbitCarousel({ activities, selectedActivityId, loading, onSelect }: OrbitCarouselProps) {
  const orbitItems = activities.slice(0, MAX_ORBIT_ITEMS);

  return (
    <div className="orbit">
      <div className="orbit__glow" />
      <div className="orbit__core">
        <div className="orbit__core-label">Crew sync</div>
        <strong>{loading ? "Mixing tastes..." : "Ready for pickup"}</strong>
        <span>Tap a capsule to inspect</span>
      </div>

      <ul className={`orbit__ring ${loading ? "orbit__ring--pause" : ""}`}>
        {orbitItems.length === 0 && !loading ? (
          <li className="orbit__empty">
            Tell us the vibe and we’ll populate this orbit with agent-picked spots.
          </li>
        ) : null}

        {orbitItems.map((activity, index) => {
          const angle = (index / orbitItems.length) * 360;
          const style = {
            "--orbit-angle": `${angle}deg`,
          } as React.CSSProperties;
          const isActive = selectedActivityId === activity.id;
          const initial = activity.title.slice(0, 1).toUpperCase();

          return (
            <li key={activity.id} className={`orbit__item ${isActive ? "orbit__item--active" : ""}`} style={style}>
              <button type="button" onClick={() => onSelect(activity)}>
                <span className="orbit__item-initial">{initial}</span>
                <span className="orbit__item-title">{activity.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

