"use client";

import { formatRelativeDate } from "@/lib/utils";
import type { Transcript } from "@/types";

interface TranscriptCardProps {
  transcript: Transcript;
  onClick: () => void;
}

export function TranscriptCard({ transcript, onClick }: TranscriptCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl hover:bg-surface-overlay transition-colors duration-150 group"
    >
      <p className="text-[15px] text-text-primary font-medium group-hover:text-black dark:group-hover:text-white transition-colors truncate">
        {transcript.title}
      </p>
      <p className="text-sm text-text-tertiary mt-0.5">
        {formatRelativeDate(transcript.date)}
      </p>
    </button>
  );
}
