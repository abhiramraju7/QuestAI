import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { ActivityResult, invokeAgent, searchActivities } from "./lib/api";
import { Hero } from "./components/Hero";
import { ActivityPanel } from "./components/ActivityPanel";
import { MapPanel } from "./components/MapPanel";
import { MatchPanel } from "./components/MatchPanel";

type FormState = {
  query_text: string;
  location?: string;
  budget_cap?: string;
};

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

export type ActivityWithMatch = ActivityResult & {
  match: MatchBreakdown;
};

const DEFAULT_FORM: FormState = {
  query_text: "Live music with arcade games",
  location: "Boston, MA",
  budget_cap: "",
};

const SUGGESTIONS = [
  "Sip-and-paint night with friends",
  "Open mic comedy downtown",
  "Outdoor skating with food trucks",
  "Late-night board game cafe",
  "Trampoline park party",
];

function createFriend(overrides: Partial<FriendProfile> = {}): FriendProfile {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `friend-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    name: "",
    likes: "",
    ...overrides,
  };
}

const INITIAL_FRIENDS: FriendProfile[] = [createFriend({ name: "Friend 1" }), createFriend({ name: "Friend 2" })];

export default function App() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [friends, setFriends] = useState<FriendProfile[]>(INITIAL_FRIENDS);
  const [activities, setActivities] = useState<ActivityWithMatch[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityWithMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [agentSummary, setAgentSummary] = useState<string | null>(null);
  const [agentKeywords, setAgentKeywords] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setAgentSummary(null);
    setAgentKeywords([]);

    try {
      const budget = form.budget_cap ? Number(form.budget_cap) : undefined;
      const friendPayload = friends.reduce<Record<string, { likes: string[] }>>((acc, friend) => {
        const likes = friend.likes
          .split(/[,;\n]/)
          .map((item) => item.trim())
          .filter(Boolean);
        if (likes.length > 0) {
          acc[friend.id] = { likes };
        }
        return acc;
      }, {});

      const agentPayload = {
        prompt: form.query_text,
        location: form.location || undefined,
        budget_cap: Number.isFinite(budget) ? budget : undefined,
        friends: friendPayload,
      };

      let agentActivities: ActivityResult[] = [];
      try {
        const agentResult = await invokeAgent(agentPayload);
        setAgentSummary(agentResult.summary ?? null);
        setAgentKeywords(agentResult.keywords ?? []);
        agentActivities = agentResult.activities ?? [];
      } catch (agentErr) {
        console.warn("Agent invocation failed:", agentErr);
      }

      let results = agentActivities;

      if (!results.length) {
        results = await searchActivities({
          query_text: form.query_text,
          location: form.location || undefined,
          budget_cap: Number.isFinite(budget) ? budget : undefined,
        });
      }

      const scored = results.map<ActivityWithMatch>((activity) => ({
        ...activity,
        match: computeMatchScores(activity, form.query_text, agentKeywords, friends),
      }));

      setActivities(scored);
      setSelectedActivity((prev) => {
        if (!prev) {
          return scored[0] ?? null;
        }
        const match = scored.find((item) => item.id === prev.id);
        return match ?? scored[0] ?? null;
      });
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setActivities([]);
      setSelectedActivity(null);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!selectedActivity) {
      return;
    }
    if (!activities.some((activity) => activity.id === selectedActivity.id)) {
      setSelectedActivity(null);
    }
  }, [activities, selectedActivity]);

  const topActivities = useMemo(() => activities.slice(0, 40), [activities]);

  function handleSuggestionClick(text: string) {
    setForm((prev) => ({ ...prev, query_text: text }));
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setFriends(INITIAL_FRIENDS.map((friend, index) => createFriend({ name: friend.name || `Friend ${index + 1}` })));
    setActivities([]);
    setSelectedActivity(null);
    setError(null);
    setHasSearched(false);
    setAgentSummary(null);
    setAgentKeywords([]);
  }

  function handleFriendChange(id: string, updates: Partial<FriendProfile>) {
    setFriends((prev) => prev.map((friend) => (friend.id === id ? { ...friend, ...updates } : friend)));
  }

  function handleAddFriend() {
    setFriends((prev) => [...prev, createFriend({ name: `Friend ${prev.length + 1}` })]);
  }

  function handleRemoveFriend(id: string) {
    setFriends((prev) => (prev.length <= 1 ? prev : prev.filter((friend) => friend.id !== id)));
  }

  return (
    <div className="page">
      <div className="page__inner">
        <Hero
          form={form}
          loading={loading}
          agentSummary={agentSummary}
          agentKeywords={agentKeywords}
          suggestions={SUGGESTIONS}
          friends={friends}
          onSubmit={handleSubmit}
          onFormChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
          onSuggestion={handleSuggestionClick}
          onReset={handleReset}
          onFriendChange={handleFriendChange}
          onAddFriend={handleAddFriend}
          onRemoveFriend={handleRemoveFriend}
        />

        <main className="panels">
          <ActivityPanel
            activities={topActivities}
            loading={loading}
            hasSearched={hasSearched}
            error={error}
            selectedActivityId={selectedActivity?.id ?? null}
            onSelect={(activity) => setSelectedActivity(activity)}
          />

          <MatchPanel activity={selectedActivity} friends={friends} />
        </main>

        <MapPanel activity={selectedActivity} />
      </div>
    </div>
  );
}

type Haystack = {
  raw: string;
  tokens: Set<string>;
};

function computeMatchScores(
  activity: ActivityResult,
  prompt: string,
  agentKeywords: string[],
  friends: FriendProfile[]
): MatchBreakdown {
  const haystack = buildHaystack(activity, agentKeywords);
  const promptScore = phraseSimilarity(prompt, haystack);

  const friendMatches = friends
    .map(({ id, name, likes }, index) => {
      const score = phraseSimilarity(likes, haystack);
      return {
        id,
        name: name.trim() || `Friend ${index + 1}`,
        likes: likes.trim(),
        score,
      };
    })
    .filter((friend) => friend.likes.length > 0)
    .map(({ likes: _likes, ...rest }) => rest);

  const denominator = friendMatches.length + 1;
  const overall =
    denominator > 0
      ? clampScore((promptScore + friendMatches.reduce((sum, friend) => sum + friend.score, 0)) / denominator)
      : promptScore;

  return {
    overall,
    prompt: promptScore,
    friends: friendMatches,
  };
}

function buildHaystack(activity: ActivityResult, agentKeywords: string[]): Haystack {
  const raw = [
    activity.title,
    activity.summary,
    activity.address,
    activity.price,
    activity.tags?.join(" "),
    agentKeywords.join(" "),
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return {
    raw,
    tokens: tokenize(raw),
  };
}

function phraseSimilarity(phrase: string, haystack: Haystack): number {
  const fragments = splitFragments(phrase);
  if (fragments.length === 0) {
    return 0;
  }

  let counted = 0;
  let total = 0;

  for (const fragment of fragments) {
    const tokens = tokenize(fragment);
    if (tokens.size === 0) {
      continue;
    }
    counted += 1;

    let matches = 0;
    tokens.forEach((token) => {
      if (matchesToken(token, haystack)) {
        matches += 1;
      }
    });

    const fragmentScore = matches / tokens.size || 0;
    total += fragmentScore;
  }

  if (counted === 0) {
    return 0;
  }

  const average = total / counted;
  if (average === 0) {
    return 0.05;
  }

  return clampScore(average);
}

function splitFragments(text: string): string[] {
  if (!text) {
    return [];
  }
  return text
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function matchesToken(token: string, haystack: Haystack): boolean {
  if (!token) {
    return false;
  }

  if (haystack.tokens.has(token)) {
    return true;
  }

  if (haystack.raw.includes(token)) {
    return true;
  }

  const stem = stemToken(token);
  if (stem && (haystack.tokens.has(stem) || haystack.raw.includes(stem))) {
    return true;
  }

  return false;
}

function tokenize(value: string | null | undefined): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function stemToken(token: string): string | null {
  if (token.length <= 4) {
    return null;
  }
  const rules: Array<[string, string]> = [
    ["ing", ""],
    ["ers", ""],
    ["er", ""],
    ["ies", "y"],
    ["s", ""],
  ];
  for (const [suffix, replacement] of rules) {
    if (token.endsWith(suffix)) {
      return token.slice(0, -suffix.length) + replacement;
    }
  }
  return null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}

