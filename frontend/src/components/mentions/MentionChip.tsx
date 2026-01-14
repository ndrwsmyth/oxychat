"use client";

import { X } from "lucide-react";

interface MentionChipProps {
  title: string;
  onRemove: () => void;
}

/**
 * Pill-style chip for displaying a mention reference.
 * Used in the composer to show selected mentions.
 */
export function MentionChip({ title, onRemove }: MentionChipProps) {
  return (
    <span className="oxy-mention-chip">
      <span className="oxy-mention-chip-at">@</span>
      <span className="oxy-mention-chip-title">{title}</span>
      <button
        type="button"
        className="oxy-mention-chip-remove"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRemove();
        }}
        aria-label={`Remove ${title}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}
