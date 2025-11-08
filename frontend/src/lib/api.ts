const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

type GroupRequest = {
  query_text: string;
  user_ids: string[];
  location_hint?: string;
  time_window?: string;
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

export async function fetchDashboard(params?: {
  location?: string;
  vibe?: string;
  time_window?: string;
  user_ids?: string;
}) {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = new URL(API_BASE ? `${base}/api/v1/dashboard` : `${base}/dashboard`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json();
}

