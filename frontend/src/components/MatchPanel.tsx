import React, { useMemo } from "react";
import { ActivityResult } from "../lib/api";

type FriendProfile = {
  id: string;
  name: string;
  likes: string;
};

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

type MatchPanelProps = {
  activity: ActivityWithMatch | null;
  friends: FriendProfile[];
};

type Axis = {
  id: string;
  label: string;
  score: number;
};

export function MatchPanel({ activity, friends }: MatchPanelProps) {
  const axes = useMemo<Axis[]>(() => {
    if (!activity) {
      return [];
    }

    const promptAxis: Axis = {
      id: "prompt",
      label: "Prompt fit",
      score: activity.match.prompt,
    };

    const friendAxes = friends.map<Axis>((friend) => {
      const entry = activity.match.friends.find((item) => item.id === friend.id);
      return {
        id: friend.id,
        label: friend.name,
        score: entry?.score ?? 0,
      };
    });

    return [promptAxis, ...friendAxes];
  }, [activity, friends]);

  if (!activity) {
    return (
      <section className="match-panel match-panel--empty">
        <h3>No selection yet</h3>
        <p>Run a search and pick an activity to see how it stacks up for everyone.</p>
      </section>
    );
  }

  return (
    <section className="match-panel">
      <header className="match-panel__header">
        <div>
          <h3>Fit breakdown</h3>
          <p>How closely this spot matches your prompt and each crew member.</p>
        </div>
        <div className="match-panel__score">
          <span>Overall match</span>
          <strong>{Math.round(activity.match.overall * 100)}%</strong>
        </div>
      </header>

      <RadarChart axes={axes} />

      <ul className="match-panel__legend">
        {axes.map((axis) => (
          <li key={axis.id}>
            <span>{axis.label}</span>
            <strong>{Math.round(axis.score * 100)}%</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RadarChart({ axes }: { axes: Axis[] }) {
  const size = 260;
  const center = size / 2;
  const radius = 110;
  const spokes = axes.length || 1;

  function pointFor(score: number, index: number) {
    const angle = (Math.PI * 2 * index) / spokes - Math.PI / 2;
    const r = radius * score;
    return {
      x: center + Math.cos(angle) * r,
      y: center + Math.sin(angle) * r,
    };
  }

  function polygonPath(scale: number) {
    return axes
      .map((_, index) => {
        const { x, y } = pointFor(scale, index);
        return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ")
      .concat(" Z");
  }

  const ringScales = [0.25, 0.5, 0.75, 1];
  const valuePath = axes.length > 0 ? polygonPathFromValues(axes, pointFor) : "";

  return (
    <div className="radar">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Match radar chart">
        <g className="radar__grid">
          {ringScales.map((scale) => (
            <path key={scale} d={polygonPath(scale)} />
          ))}
        </g>

        {axes.map((axis, index) => {
          const { x, y } = pointFor(1, index);
          return (
            <g key={axis.id} className="radar__axis">
              <line x1={center} y1={center} x2={x} y2={y} />
              <text x={x} y={y} dy={y < center ? -8 : 14} className="radar__label">
                {axis.label}
              </text>
            </g>
          );
        })}

        {valuePath ? <path className="radar__value" d={valuePath} /> : null}
      </svg>
    </div>
  );
}

function polygonPathFromValues(axes: Axis[], pointFor: (score: number, index: number) => { x: number; y: number }) {
  return axes
    .map((axis, index) => {
      const { x, y } = pointFor(axis.score, index);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ")
    .concat(" Z");
}

