const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

export type ActivitySearchPayload = {
  query_text: string;
  location?: string;
  budget_cap?: number;
};

export type ActivityResult = {
  id: string;
  title: string;
  summary?: string | null;
  source: string;
  address?: string | null;
  price?: string | null;
  booking_url?: string | null;
  maps_url?: string | null;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  tags?: string[];
};

export async function searchActivities(payload: ActivitySearchPayload): Promise<ActivityResult[]> {
  const base = API_BASE || `${window.location.origin}/.netlify/functions`;
  const url = API_BASE ? `${base}/api/v1/activities` : `${base}/activities`;

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

