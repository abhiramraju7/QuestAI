const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

type GroupRequest = {
  query_text: string;
  user_ids: string[];
  location_hint?: string;
  time_window?: string;
  vibe_hint?: string;
  budget_cap?: number;
  distance_km?: number;
  custom_likes?: string[];
  custom_tags?: string[];
};

export async function fetchPlan(payload: GroupRequest) {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/plan` : `${base}/plan`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return res.json();
}

export async function sendFeedback(payload: {
  user_id: string;
  item_title: string;
  emoji: string;
  strength?: number;
}) {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/feedback` : `${base}/feedback`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  return res.json();
}

export async function postVisit(payload: {
  user_ids: string[];
  title: string;
  lat: number;
  lng: number;
}) {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/visit` : `${base}/visit`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchVisited() {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/visited` : `${base}/visited`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchProgress() {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/progress` : `${base}/progress`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

