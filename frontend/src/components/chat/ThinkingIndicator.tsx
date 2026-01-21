"use client";

export function ThinkingIndicator() {
  return (
    <div className="oxy-thinking" role="status" aria-label="AI is thinking">
      <div className="oxy-thinking-dot" aria-hidden="true" />
      <span>Thinking...</span>
    </div>
  );
}
