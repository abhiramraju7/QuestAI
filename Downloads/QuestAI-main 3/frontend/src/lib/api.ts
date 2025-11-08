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
  const url = API_BASE
    ? `${API_BASE}/api/v1/plan`
    : `/api/v1/plan`;

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

type VisitIn = {
  user_id: string;
  title: string;
  address?: string;
  lat: number;
  lng: number;
  place_id?: string;
  rating?: number;
  review?: string;
  group_id?: string;
  completed_at?: string;
};

export async function recordVisit(payload: VisitIn) {
  const url = API_BASE
    ? `${API_BASE}/api/v1/visits`
    : `/api/v1/visits`;
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

export async function fetchProgress(userIds: string[], resolution = 9) {
  const params = new URLSearchParams();
  userIds.forEach((u) => params.append("user_id", u));
  params.set("resolution", String(resolution));
  const url = API_BASE
    ? `${API_BASE}/api/v1/progress?${params.toString()}`
    : `/api/v1/progress?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }
  return res.json();
}

