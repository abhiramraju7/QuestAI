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
  friend_overrides?: Array<{
    user_id: string;
    display_name?: string;
    likes?: string[];
    vibes?: string[];
    tags?: string[];
    budget_max?: number;
    distance_km_max?: number;
  }>;
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

export type EventSearchParams = {
  q?: string;
  location?: string;
  vibe?: string;
  provider?: "eventbrite" | "google_places";
  likes?: string[];
  tags?: string[];
  limit?: number;
};

export type EventItem = {
  id: string;
  title: string;
  summary?: string | null;
  source: string;
  venue?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  booking_url?: string | null;
  maps_url?: string | null;
  price?: string | null;
  vibe?: string | null;
  tags?: string[];
  start_time?: string | null;
  end_time?: string | null;
};

export async function fetchEvents(params: EventSearchParams = {}): Promise<EventItem[]> {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/events` : `${base}/events`;

  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.location) query.set("location", params.location);
  if (params.vibe) query.set("vibe", params.vibe);
  if (params.provider) query.set("provider", params.provider);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.likes?.length) query.set("likes", params.likes.join(","));
  if (params.tags?.length) query.set("tags", params.tags.join(","));

  const requestUrl = query.toString() ? `${url}?${query.toString()}` : url;
  const res = await fetch(requestUrl, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed with ${res.status}`);
  }

  return res.json();
}

