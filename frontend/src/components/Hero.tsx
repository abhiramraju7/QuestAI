import React, { FormEvent } from "react";
import { ActivityResult } from "../lib/api";
import { OrbitCarousel } from "./OrbitCarousel";

type FormState = {
  query_text: string;
  location?: string;
  budget_cap?: string;
};

type HeroProps = {
  form: FormState;
  loading: boolean;
  agentSummary: string | null;
  agentKeywords: string[];
  suggestions: string[];
  orbitActivities: ActivityResult[];
  selectedActivityId: string | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (field: keyof FormState, value: string) => void;
  onSuggestion: (text: string) => void;
  onReset: () => void;
  onSelectActivity: (activity: ActivityResult) => void;
};

export function Hero({
  form,
  loading,
  agentSummary,
  agentKeywords,
  suggestions,
  orbitActivities,
  selectedActivityId,
  onSubmit,
  onFormChange,
  onSuggestion,
  onReset,
  onSelectActivity,
}: HeroProps) {
  return (
    <section className="hero-grid">
      <div className="hero-grid__copy">
        <div className="hero-grid__badge">Challo</div>
        <h1>Agent-crafted nights out.</h1>
        <p>
          Describe the energy you&apos;re chasing. Challo blends everyone’s interests, chats with Gemini, and surfaces
          fun spots that fit.
        </p>

        {agentSummary ? (
          <div className="hero-grid__summary">
            <div className="hero-grid__summary-label">Gemini says</div>
            <p>{agentSummary}</p>
            {agentKeywords.length > 0 && (
              <div className="hero-grid__chips">
                {agentKeywords.map((keyword) => (
                  <span key={keyword} className="tag-chip">
                    {keyword}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <form className="search-form" onSubmit={onSubmit}>
          <label className="field field--textarea">
            <span>Describe the plan</span>
            <textarea
              value={form.query_text}
              onChange={(event) => onFormChange("query_text", event.target.value)}
              rows={3}
              placeholder="Neon-lit arcade with DJ sets and mocktails"
              required
            />
          </label>

          <div className="search-form__row">
            <label className="field">
              <span>City or neighborhood</span>
              <input
                value={form.location ?? ""}
                onChange={(event) => onFormChange("location", event.target.value)}
                placeholder="Boston, MA"
              />
            </label>
            <label className="field">
              <span>Budget cap (optional)</span>
              <input
                type="number"
                min="0"
                value={form.budget_cap ?? ""}
                onChange={(event) => onFormChange("budget_cap", event.target.value)}
                placeholder="45"
              />
            </label>
          </div>

          <div className="search-form__actions">
            <button type="submit" className="btn btn--primary" disabled={loading}>
              {loading ? "Blending..." : "Spin up ideas"}
            </button>
            <button type="button" className="btn btn--ghost" onClick={onReset}>
              Reset
            </button>
          </div>

          <div className="search-form__suggestions">
            {suggestions.map((suggestion) => (
              <button
                type="button"
                key={suggestion}
                className="suggestion-chip"
                onClick={() => onSuggestion(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      </div>

      <div className="hero-grid__orbit">
        <OrbitCarousel
          activities={orbitActivities}
          selectedActivityId={selectedActivityId}
          loading={loading}
          onSelect={onSelectActivity}
        />
      </div>
    </section>
  );
}

