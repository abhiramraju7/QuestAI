/// <reference path="../types/react-shim.d.ts" />
import React, { useEffect, useMemo, useRef, useState } from "react";

export type ConstellationUser = {
  id: string;
  name: string;
  color: string;
  hobbies: string[];
};

export type ConstellationActivity = {
  id: string;
  title: string;
  vibe: string;
  reasons: string[];
  weight?: number;
};

type Edge = {
  u: number; // user index
  a: number; // activity index
  w: number; // weight 0..1
};

type Props = {
  users: ConstellationUser[];
  activities: ConstellationActivity[];
  onSelect?: (activity: ConstellationActivity) => void;
  height?: number;
};

// naive tokenizer
function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  const uni = new Set([...A, ...B]).size || 1;
  return inter / uni;
}

export default function Constellation({
  users,
  activities,
  onSelect,
  height = 560,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null); // activity index
  const [dpi, setDpi] = useState<number>(1);

  const sized = useMemo(() => {
    // generate more nodes if small input
    const base = activities.length >= 20 ? activities : [...activities];
    while (base.length < 28) {
      const pick = activities[base.length % activities.length];
      base.push({
        ...pick,
        id: `${pick.id}-x${base.length}`,
        title: mutateTitle(pick.title),
        reasons: pick.reasons.slice(0, 2),
        weight: 0.6,
      });
    }
    return base;
  }, [activities]);

  const edges = useMemo<Edge[]>(() => {
    const e: Edge[] = [];
    const hobbyTokens = users.map((u) => tokenize(u.hobbies.join(" ")));
    sized.forEach((act, ai) => {
      const tokens = [
        ...tokenize(act.title),
        act.vibe.toLowerCase(),
        ...tokenize(act.reasons.join(" ")),
      ];
      users.forEach((u, ui) => {
        const w = jaccard(tokens, hobbyTokens[ui]);
        if (w > 0.12) e.push({ u: ui, a: ai, w: Math.min(1, w * 1.8) });
      });
    });
    return e;
  }, [sized, users]);

  useEffect(() => {
    const canvas = canvasRef.current as HTMLCanvasElement;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

    const parent = canvas.parentElement!;
    function resize() {
      const ratio = window.devicePixelRatio || 1;
      setDpi(ratio);
      canvas.width = Math.floor(parent.clientWidth * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = parent.clientWidth + "px";
      canvas.style.height = height + "px";
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    // layout init
    const W = () => canvas.width;
    const H = () => canvas.height;
    const N = sized.length;
    const M = users.length;
    const ax = new Float32Array(N);
    const ay = new Float32Array(N);
    const avx = new Float32Array(N);
    const avy = new Float32Array(N);
    const ar = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      ax[i] = (Math.random() * 0.7 + 0.15) * W();
      ay[i] = (Math.random() * 0.7 + 0.15) * H();
      avx[i] = (Math.random() - 0.5) * 0.3;
      avy[i] = (Math.random() - 0.5) * 0.3;
      ar[i] = 16 + Math.random() * 8;
    }
    const ux = new Float32Array(M);
    const uy = new Float32Array(M);
    const ur = new Float32Array(M);
    const ringR = Math.min(W(), H()) * 0.35;
    for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2 - Math.PI / 2;
      ux[i] = W() / 2 + Math.cos(a) * ringR;
      uy[i] = H() / 2 + Math.sin(a) * ringR;
      ur[i] = 18;
    }

    let raf = 0;
    const repulsion = 10000;
    const springK = 0.002;
    const centerK = 0.0006;
    const friction = 0.985;

    function step() {
      // activity-activity repulsion
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = ax[j] - ax[i];
          const dy = ay[j] - ay[i];
          const d2 = dx * dx + dy * dy + 0.01;
          const f = repulsion / d2;
          const nx = (dx / Math.sqrt(d2)) * f;
          const ny = (dy / Math.sqrt(d2)) * f;
          avx[i] -= nx;
          avy[i] -= ny;
          avx[j] += nx;
          avy[j] += ny;
        }
      }
      // springs user->activity
      for (const e of edges) {
        const i = e.a;
        const j = e.u;
        const dx = ux[j] - ax[i];
        const dy = uy[j] - ay[i];
        avx[i] += dx * springK * e.w;
        avy[i] += dy * springK * e.w;
      }
      // gentle center pull
      for (let i = 0; i < N; i++) {
        avx[i] += (W() / 2 - ax[i]) * centerK;
        avy[i] += (H() / 2 - ay[i]) * centerK;
      }
      // integrate
      for (let i = 0; i < N; i++) {
        avx[i] *= friction;
        avy[i] *= friction;
        ax[i] += avx[i];
        ay[i] += avy[i];
      }
      draw();
      raf = requestAnimationFrame(step);
    }

    function draw() {
      ctx.clearRect(0, 0, W(), H());
      // edges
      ctx.lineWidth = 1.5 * dpi;
      for (const e of edges) {
        const i = e.a;
        const j = e.u;
        const a = Math.max(0.1, Math.min(0.9, e.w));
        ctx.strokeStyle =
          hoverIdx === i
            ? `rgba(147, 197, 253, ${0.7 * a})`
            : `rgba(148, 163, 184, ${0.25 * a})`;
        ctx.beginPath();
        ctx.moveTo(ax[i], ay[i]);
        ctx.lineTo(ux[j], uy[j]);
        ctx.stroke();
      }
      // users
      for (let i = 0; i < M; i++) {
        ctx.beginPath();
        ctx.fillStyle = users[i].color;
        ctx.strokeStyle = "rgba(255,255,255,0.6)";
        ctx.lineWidth = 2 * dpi;
        ctx.arc(ux[i], uy[i], ur[i], 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // label
        ctx.fillStyle = "#0b0c10";
        ctx.font = `${12 * dpi}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(users[i].name, ux[i], uy[i] + 4 * dpi);
      }
      // activities
      for (let i = 0; i < N; i++) {
        const isHover = hoverIdx === i;
        const r = ar[i] * (isHover ? 1.15 : 1);
        const halo = isHover ? 0.38 : 0.22;
        ctx.beginPath();
        ctx.fillStyle = `rgba(99,179,237,${halo})`;
        ctx.arc(ax[i], ay[i], r + 10 * dpi, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = "rgba(15,20,30,0.95)";
        ctx.strokeStyle = "rgba(203,213,245,0.4)";
        ctx.lineWidth = 2 * dpi;
        ctx.arc(ax[i], ay[i], r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // title
        ctx.fillStyle = "#e2e8f0";
        ctx.font = `${12 * dpi}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(sized[i].title.slice(0, 18), ax[i], ay[i] - 2 * dpi);
        ctx.fillStyle = "#9aa5b1";
        ctx.font = `${10 * dpi}px Inter, system-ui, -apple-system, sans-serif`;
        ctx.fillText(capitalize(sized[i].vibe), ax[i], ay[i] + 12 * dpi);
      }
    }

    function onMove(ev: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      const mx = (ev.clientX - rect.left) * dpi;
      const my = (ev.clientY - rect.top) * dpi;
      let best = -1;
      let bestD2 = 999999;
      for (let i = 0; i < sized.length; i++) {
        const d2 = (ax[i] - mx) ** 2 + (ay[i] - my) ** 2;
        if (d2 < bestD2 && d2 < 60 * 60) {
          bestD2 = d2;
          best = i;
        }
      }
      setHoverIdx(best >= 0 ? best : null);
    }
    function onClick() {
      if (hoverIdx != null && onSelect) onSelect(sized[hoverIdx]);
    }

    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("click", onClick);
    step();
    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("click", onClick);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sized, users, edges, height, dpi, onSelect]);

  return (
    <div className="qm-constellation">
      <canvas ref={canvasRef} className="qm-constellation-canvas" />
    </div>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function mutateTitle(s: string) {
  const suffixes = ["+", " Express", " Pop-up", " Night", " Remix", " Hub"];
  return s + suffixes[Math.floor(Math.random() * suffixes.length)];
}


