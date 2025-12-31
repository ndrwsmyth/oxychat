"use client";

interface OxyEmptyStateProps {
  onStarterClick: (text: string) => void;
}

const starters = [
  { label: "Summarize", detail: "recent meetings" },
  { label: "Find", detail: "action items" },
  { label: "Search", detail: "by topic" },
];

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export function OxyEmptyState({ onStarterClick }: OxyEmptyStateProps) {
  return (
    <div className="oxy-empty">
      <div className="oxy-empty-top">
        <p className="oxy-empty-time">Good {getGreeting()}</p>
        <h1 className="oxy-empty-title">What would you like to know?</h1>
      </div>

      <div className="oxy-empty-middle">
        <p className="oxy-empty-desc">
          I can search your meeting transcripts, summarize discussions,
          surface decisions, and help you recall what was said.
        </p>
      </div>

      <div className="oxy-starters">
        {starters.map((s, i) => (
          <button
            key={i}
            className="oxy-starter"
            onClick={() => onStarterClick(`${s.label} ${s.detail}`)}
          >
            <span className="oxy-starter-label">{s.label}</span>
            <span className="oxy-starter-detail">{s.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
