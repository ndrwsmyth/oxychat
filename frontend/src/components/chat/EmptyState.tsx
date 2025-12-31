"use client";

import { getGreeting } from "@/lib/utils";

interface EmptyStateProps {
  onPromptClick: (prompt: string) => void;
}

const starterPrompts = [
  "What were the key decisions from last week's meetings?",
  "Summarize the latest client feedback",
  "What action items are pending?",
];

export function EmptyState({ onPromptClick }: EmptyStateProps) {
  const greeting = getGreeting();

  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-up">
      <p className="text-sm text-text-tertiary mb-2">{greeting}</p>
      <h1 className="text-2xl font-semibold text-text-primary mb-3">
        How can I help you today?
      </h1>
      <p className="text-text-secondary text-center max-w-md mb-10">
        Ask me anything about your meetings, projects, or planning. Use{" "}
        <span className="text-text-primary font-medium">@</span> to reference
        specific transcripts.
      </p>

      <div className="flex flex-col gap-2 w-full max-w-md">
        {starterPrompts.map((prompt, index) => (
          <button
            key={index}
            onClick={() => onPromptClick(prompt)}
            className="text-left px-4 py-3 rounded-xl border border-border text-text-secondary hover:text-text-primary hover:border-border-strong hover:bg-surface-overlay transition-all duration-150 text-sm"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}
