"use client";

function getTimeContext() {
  const hour = new Date().getHours();

  if (hour < 5) return { greeting: "Working late", prompt: "What's keeping you up?" };
  if (hour < 8) return { greeting: "Good morning", prompt: "What's on the agenda?" };
  if (hour < 12) return { greeting: "Good morning", prompt: "What are we tackling today?" };
  if (hour < 17) return { greeting: "Good afternoon", prompt: "What are you working on?" };
  if (hour < 20) return { greeting: "Good evening", prompt: "Wrapping up anything?" };
  return { greeting: "Good evening", prompt: "What's on your mind?" };
}

export function OxyEmptyState() {
  const { greeting, prompt } = getTimeContext();

  return (
    <div className="oxy-empty">
      <div className="oxy-empty-top">
        <p className="oxy-empty-time">{greeting}</p>
        <h1 className="oxy-empty-title">{prompt}</h1>
      </div>

      <div className="oxy-empty-middle">
        <p className="oxy-empty-desc">
          I can search your meeting transcripts, summarize discussions,
          surface decisions, and help you recall what was said.
        </p>
      </div>
    </div>
  );
}
