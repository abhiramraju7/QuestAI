import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, Marker } from "mapbox-gl";
import { fetchPlan, fetchProgress, recordVisit } from "./lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { cellToBoundary } from "h3-js";

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
  { id: "u1", name: "Abhiram", tags: ["music", "creative", "night"] },
  { id: "u2", name: "Nina", tags: ["outdoors", "budget", "daytime"] },
  { id: "u3", name: "Kai", tags: ["cozy", "games", "mindful"] },
];

const ATLANTA = { lat: 33.7490, lng: -84.3880, zoom: 11.3 };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default function App() {
  const mapRef = useRef<Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const mapToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const mapDisabled = !mapToken;

  const [selectedFriends, setSelectedFriends] = useState<string[]>(["u1", "u2", "u3"]);
  const [progress, setProgress] = useState<{ percent_explored: number } | null>(null);
  const [cards, setCards] = useState<PlanCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const nodes = useMemo(() => {
    return FRIENDS.map((f, idx) => ({
      id: f.id,
      name: f.name,
      x: 24 + idx * 120,
      y: 72,
      tags: f.tags,
    }));
  }, []);
  const edges = useMemo(() => {
    function sim(a: string[], b: string[]) {
      const A = new Set(a.map((t) => t.toLowerCase()));
      const B = new Set(b.map((t) => t.toLowerCase()));
      let inter = 0;
      A.forEach((t) => {
        if (B.has(t)) inter += 1;
      });
      return inter;
    }
    const list: Array<{ from: number; to: number; w: number }> = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const w = sim((FRIENDS[i].tags as string[]), (FRIENDS[j].tags as string[]));
        list.push({ from: i, to: j, w });
      }
    }
    return list;
  }, [nodes]);

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

  useEffect(() => {
    if (mapDisabled) {
      setError((e) => e || "Map is disabled: missing VITE_MAPBOX_TOKEN.");
      return;
    }
    mapboxgl.accessToken = mapToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current as HTMLElement,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [ATLANTA.lng, ATLANTA.lat],
      zoom: ATLANTA.zoom,
      pitch: 45,
      antialias: true,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

    map.on("load", () => {
      setMapReady(true);
      // visited hex polygons
      map.addSource("visited-hex", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });
      map.addLayer({
        id: "visited-hex-fill",
        type: "fill",
        source: "visited-hex",
        paint: {
          "fill-color": "#63b3ed",
          "fill-opacity": 0.22,
        },
      });
      map.addLayer({
        id: "visited-hex-outline",
        type: "line",
        source: "visited-hex",
        paint: {
          "line-color": "#63b3ed",
          "line-width": 1,
          "line-opacity": 0.6,
        },
      });
    });
    return () => {
      clearMarkers();
      setMapReady(false);
      map && map.remove();
    };
  }, [mapDisabled, mapToken]);

  useEffect(() => {
    // initial progress fetch
    (async () => {
      try {
        const pr = await fetchProgress(selectedFriends);
        setProgress(pr);
      } catch {
        // ignore
      }
    })();
  }, []);

  function toggleFriend(id: string) {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]
    );
  }

  function addVisitedHex(h3Index: string) {
    const map = mapRef.current;
    if (!map) return;
    const boundary = cellToBoundary(h3Index, true) as [number, number][];
    const feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [boundary.map(([lat, lng]) => [lng, lat])],
      },
    };
    const src = map.getSource("visited-hex") as mapboxgl.GeoJSONSource;
    const current = (src as any)._data || { type: "FeatureCollection", features: [] };
    const next = {
      type: "FeatureCollection",
      features: [...(current.features || []), feature],
    };
    src.setData(next as any);
  }

  function clearMarkers() {
    markersRef.current.forEach((marker) => {
      try {
        marker.remove();
      } catch {
        // ignore marker removal failures
      }
    });
    markersRef.current = [];
  }

  function dropMarker(card: PlanCard) {
    const map = mapRef.current;
    if (!map || !card.lat || !card.lng) return;
    const el = document.createElement("div");
    el.className = "pin";
    el.style.setProperty(
      "--pin-color",
      vibePalette[(card.vibe || "chill").toLowerCase()] ?? "#63b3ed"
    );
    const summaryText = card.summary ? card.summary.replace(/\s+/g, " ").trim() : null;
    const summary = summaryText ? escapeHtml(summaryText.slice(0, 220)) : null;
    const popupHtml = `
      <div class="popup-card">
        <h3>${escapeHtml(card.title)}</h3>
        ${summary ? `<p>${summary}${card.summary && card.summary.length > 220 ? "&hellip;" : ""}</p>` : ""}
        <div class="popup-links">
          ${card.booking_url ? `<a href="${escapeHtml(card.booking_url)}" target="_blank" rel="noreferrer">Event</a>` : ""}
          ${card.maps_url ? `<a href="${escapeHtml(card.maps_url)}" target="_blank" rel="noreferrer">Map</a>` : ""}
        </div>
      </div>
    `;
    const popup = new mapboxgl.Popup({ offset: 18, closeButton: true }).setHTML(popupHtml);
    const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
      .setLngLat([card.lng, card.lat])
      .setPopup(popup)
      .addTo(map);
    markersRef.current.push(marker);
  }

  async function planAtlanta() {
    setLoading(true);
    setError(null);
    setCards([]);
    try {
      const data: PlanResponse = await fetchPlan({
        query_text: "Find activities we all like under $30 this evening.",
        user_ids: selectedFriends,
        location_hint: "Atlanta, GA",
        time_window: "Tonight 5-10pm",
        custom_likes: [],
        custom_tags: ["group"],
      });
      setCards(data.candidates);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch plan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (mapDisabled || !mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    clearMarkers();
    cards.forEach(dropMarker);
    const coords = cards
      .filter((c): c is PlanCard & { lat: number; lng: number } => typeof c.lat === "number" && typeof c.lng === "number")
      .map((c) => [c.lng, c.lat] as [number, number]);
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 12.5) });
    } else {
      const bounds = coords.reduce(
        (acc, coord) => acc.extend(coord),
        new mapboxgl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 120, maxZoom: 13 });
    }
  }, [cards, mapDisabled, mapReady]);

  async function completePlace(card: PlanCard) {
    if (!card.lat || !card.lng) return;
    try {
      const res = await recordVisit({
        user_id: selectedFriends[0],
        title: card.title,
        address: card.address || undefined,
        lat: card.lat,
        lng: card.lng,
        review: undefined,
        rating: undefined,
      });
      addVisitedHex(res.h3);
      const pr = await fetchProgress(selectedFriends);
      setProgress(pr);
      setToast(`Conquered: ${card.title}`);
      setTimeout(() => setToast(null), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to record visit.");
    }
  }

  return (
    <div className="map-app">
      {!mapDisabled && <div ref={mapContainerRef} className="map-full" />}

      <div className="overlay">
        <div className="pill">
          <span className="brand">Vivi</span>
          <span className="sub">Atlanta</span>
          <div className="progress">
            <span>Explored</span>
            <strong>{progress ? `${progress.percent_explored}%` : "—"}</strong>
          </div>
        </div>

        <div className="controls">
          <div className="friends-bar">
            {FRIENDS.map((f) => {
              const active = selectedFriends.includes(f.id);
              return (
                <button
                  key={f.id}
                  className={`friend ${active ? "active" : ""}`}
                  onClick={() => toggleFriend(f.id)}
                >
                  <span className="avatar">{f.name[0]}</span>
                  <span className="name">{f.name}</span>
                </button>
              );
            })}
          </div>
          {/* mini similarity graph */}
          <svg className="mini-graph" width="420" height="110">
            {edges.map((e, idx) => {
              const a = nodes[e.from];
              const b = nodes[e.to];
              const w = Math.max(1, Math.min(6, e.w));
              return (
                <line
                  key={idx}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="rgba(129,230,217,0.8)"
                  strokeWidth={w}
                  strokeLinecap="round"
                />
              );
            })}
            {nodes.map((n, idx) => (
              <g key={idx}>
                <circle cx={n.x} cy={n.y} r={14} fill="rgba(99,179,237,0.85)" />
                <text x={n.x} y={n.y + 30} fill="#e2e8f0" textAnchor="middle" fontSize="12">
                  {n.name}
                </text>
              </g>
            ))}
          </svg>
          <div className="cta-row">
            <button className="primary" onClick={planAtlanta} disabled={loading}>
              {loading ? "Finding spots..." : "Find spots for this crew"}
            </button>
            {error && <span className="error-inline">{error}</span>}
          </div>
        </div>

        <div className="cards-scroll">
          <AnimatePresence>
            {cards.map((c) => {
              const summaryPreview = c.summary
                ? c.summary.replace(/\s+/g, " ").trim()
                : null;
              return (
                <motion.div
                  key={c.title}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mini-card"
                >
                  <div className="mini-head">
                    <h3>{c.title}</h3>
                    {c.vibe && (
                      <span
                        className="vibe"
                        style={{
                          backgroundColor:
                            vibePalette[(c.vibe || "").toLowerCase()] ?? "#CBD5F5",
                        }}
                      >
                        {c.vibe}
                      </span>
                    )}
                  </div>
                  {c.address && <p className="addr">{c.address}</p>}
                  {summaryPreview && <p className="mini-summary">{summaryPreview}</p>}
                  <div className="mini-actions">
                    {c.booking_url && (
                      <a href={c.booking_url} target="_blank" rel="noreferrer">
                        Event
                      </a>
                    )}
                    {c.maps_url && (
                      <a href={c.maps_url} target="_blank" rel="noreferrer">
                        Map
                      </a>
                    )}
                    <button onClick={() => completePlace(c)}>Mark complete</button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

