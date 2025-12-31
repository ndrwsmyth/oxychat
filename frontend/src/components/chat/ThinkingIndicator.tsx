"use client";

export function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 py-2 animate-fade-up">
      <div className="w-1.5 h-1.5 rounded-full bg-text-tertiary animate-dot-pulse" />
      <span className="text-sm text-text-tertiary animate-ellipsis">
        Searching transcripts
      </span>
    </div>
  );
}
