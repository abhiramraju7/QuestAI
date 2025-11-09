import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { ActivityResult, invokeAgent, searchActivities } from "./lib/api";
import { Hero } from "./components/Hero";
import { ActivityPanel } from "./components/ActivityPanel";
import { MapPanel } from "./components/MapPanel";

type FormState = {
  query_text: string;
  location?: string;
  budget_cap?: string;
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

export default function App() {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [activities, setActivities] = useState<ActivityResult[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<ActivityResult | null>(null);
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
      const agentPayload = {
        prompt: form.query_text,
        location: form.location || undefined,
        budget_cap: Number.isFinite(budget) ? budget : undefined,
        friends: {
          alex: { likes: ["karaoke", "late night"], budget: 40 },
          maya: { likes: ["arcade", "music"], budget: 35 },
          jordan: { likes: ["outdoors", "food trucks"], budget: 30 },
        },
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

      setActivities(results);
      setSelectedActivity((prev) => (prev && results.some((item) => item.id === prev.id) ? prev : results[0] ?? null));
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
  const orbitActivities = useMemo(() => activities.slice(0, 8), [activities]);

  function handleSuggestionClick(text: string) {
    setForm((prev) => ({ ...prev, query_text: text }));
  }

  function handleReset() {
    setForm(DEFAULT_FORM);
    setActivities([]);
    setSelectedActivity(null);
    setError(null);
    setHasSearched(false);
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
          orbitActivities={orbitActivities}
          selectedActivityId={selectedActivity?.id ?? null}
          onSubmit={handleSubmit}
          onFormChange={(field, value) => setForm((prev) => ({ ...prev, [field]: value }))}
          onSuggestion={handleSuggestionClick}
          onReset={handleReset}
          onSelectActivity={(activity) => setSelectedActivity(activity)}
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

          <MapPanel activity={selectedActivity} />
        </main>
      </div>
    </div>
  );
}

