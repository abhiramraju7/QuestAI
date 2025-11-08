/// <reference path="../types/react-shim.d.ts" />
/// <reference path="../types/vendor-shims.d.ts" />
import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

export type CMUser = {
  id: string;
  name: string;
  color: string;
  hobbies: string[];
};

export type CMActivity = {
  id: string;
  title: string;
  vibe: string;
  reasons: string[];
  score?: number; // 0..1 consensus
  distance_km?: number | null;
};

type Props = {
  users: CMUser[];
  activities: CMActivity[];
  onSelect?: (a: CMActivity) => void;
  onReact?: (a: CMActivity, emoji: string) => void;
  height?: number;
};

function toHalo(score: number | undefined) {
  const s = typeof score === "number" ? Math.max(0, Math.min(1, score)) : 0.5;
  const hue = 30 + (265 - 30) * s; // orange -> violet
  const color = `hsl(${Math.round(hue)} 85% 65% / 0.6)`;
  return `0 0 0 8px ${color}, 0 8px 28px rgba(0,0,0,0.35)`;
}

export default function ConstellationMotion({
  users,
  activities,
  onSelect,
  onReact,
  height = 560,
}: Props) {
  const [hover, setHover] = useState<string | null>(null);

  const placed = useMemo(() => {
    const out: Array<CMActivity & { x: number; y: number; r: number; layer: number }> = [];
    const total = activities.length;
    const layers = 3;
    for (let i = 0; i < total; i++) {
      const layer = i % layers;
      const r = 140 + layer * 90;
      const angle = (i / total) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r;
      out.push({ ...activities[i], x, y, r: 22 + (activities[i].score ?? 0.5) * 10, layer });
    }
    return out;
  }, [activities]);

  return (
    <div className="cm-wrap" style={{ height }}>
      <motion.div
        className="cm-ring"
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, ease: "linear", duration: 120 }}
      >
        {placed.map((n) => {
          const active = hover === n.id;
          return (
            <motion.button
              key={n.id}
              type="button"
              className={`cm-node ${active ? "cm-node--active" : ""}`}
              style={{
                transform: `translate(${n.x}px, ${n.y}px)`,
                boxShadow: toHalo(n.score),
              }}
              onMouseEnter={() => setHover(n.id)}
              onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
              onClick={() => onSelect && onSelect(n)}
              whileHover={{ scale: 1.08 }}
            >
              <span className="cm-title">{n.title}</span>
              <span className="cm-vibe">{n.vibe}</span>
              {active && (
                <div className="cm-pop">
                  <div className="cm-meta">
                    <span>{n.distance_km ? `${n.distance_km} km` : "distance —"}</span>
                    <span className="cm-dot">•</span>
                    <span>{Math.round((n.score ?? 0.5) * 100)}% match</span>
                  </div>
                  <div className="cm-reactions">
                    {["👍", "🔥", "💜", "🤔", "👎"].map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="cm-reaction"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          onReact && onReact(n, e);
                        }}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.button>
          );
        })}
      </motion.div>
      <div className="cm-center" />
      <div className="cm-users">
        {users.map((u, i) => {
          const angle = (i / users.length) * Math.PI * 2 - Math.PI / 2;
          const r = Math.min(height * 0.45, 220);
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          return (
            <div key={u.id} className="cm-user" style={{ transform: `translate(${x}px, ${y}px)`, background: u.color }}>
              {u.name}
            </div>
          );
        })}
      </div>
    </div>
  );
}


