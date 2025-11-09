import React, { FormEvent } from "react";

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

type HeroProps = {
  form: FormState;
  loading: boolean;
  agentSummary: string | null;
  agentKeywords: string[];
  suggestions: string[];
  friends: FriendProfile[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: (field: keyof FormState, value: string) => void;
  onSuggestion: (text: string) => void;
  onReset: () => void;
  onFriendChange: (id: string, likes: string) => void;
};

export function Hero({
  form,
  loading,
  agentSummary,
  agentKeywords,
  suggestions,
  friends,
  onSubmit,
  onFormChange,
  onSuggestion,
  onReset,
  onFriendChange,
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

      <div className="hero-grid__friends">
        <h3>Who’s coming?</h3>
        <p>Fine-tune the blend by tweaking each friend’s vibe list. Separate likes with commas.</p>
        <ul className="friend-editor">
          {friends.map((friend) => (
            <li key={friend.id} className="friend-editor__item">
              <span className="friend-editor__tag">{friend.name}</span>
              <textarea
                value={friend.likes}
                onChange={(event) => onFriendChange(friend.id, event.target.value)}
                rows={2}
                spellCheck={false}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

