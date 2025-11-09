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

type ActivityWithMatch = ActivityResult & {
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

const DEFAULT_FRIENDS: FriendProfile[] = [
  { id: "alex", name: "Alex", likes: "karaoke, nightlife, late-night food" },
  { id: "maya", name: "Maya", likes: "arcades, live music, mocktails" },
  { id: "jordan", name: "Jordan", likes: "outdoors, food trucks, pop-ups" },
  { id: "sasha", name: "Sasha", likes: "speakeasies, jazz, small plates" },
  { id: "liam", name: "Liam", likes: "sports bars, trivia nights, craft beer" },
];

export default function App() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [friends, setFriends] = useState<FriendProfile[]>(DEFAULT_FRIENDS);
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
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        acc[friend.id] = { likes };
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
        match: computeMatchScores(activity, form.query_text, friends),
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
    setFriends(DEFAULT_FRIENDS);
    setActivities([]);
    setSelectedActivity(null);
    setError(null);
    setHasSearched(false);
    setAgentSummary(null);
    setAgentKeywords([]);
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
          onFriendChange={(id, likes) =>
            setFriends((prev) => prev.map((friend) => (friend.id === id ? { ...friend, likes } : friend)))
          }
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

function computeMatchScores(activity: ActivityResult, prompt: string, friends: FriendProfile[]): MatchBreakdown {
  const corpus = buildCorpus(activity);
  const promptTokens = tokenize(prompt);
  const promptScore = similarityScore(promptTokens, corpus);

  const friendScores = friends.map(({ id, name, likes }) => {
    const tokens = tokenize(likes);
    return {
      id,
      name,
      score: similarityScore(tokens, corpus),
    };
  });

  const overall =
    (promptScore + friendScores.reduce((sum, friend) => sum + friend.score, 0)) / (friendScores.length + 1 || 1);

  return {
    overall,
    prompt: promptScore,
    friends: friendScores,
  };
}

function buildCorpus(activity: ActivityResult): Set<string> {
  const parts = [
    activity.title,
    activity.summary,
    activity.address,
    activity.price,
    activity.tags?.join(" "),
  ]
    .flat()
    .filter(Boolean)
    .join(" ");
  return tokenize(parts);
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

function similarityScore(tokens: Set<string>, corpus: Set<string>): number {
  if (!tokens.size || !corpus.size) {
    return 0;
  }
  let matches = 0;
  tokens.forEach((token) => {
    if (corpus.has(token)) {
      matches += 1;
    }
  });
  return Math.min(matches / Math.max(tokens.size, 1), 1);
}

