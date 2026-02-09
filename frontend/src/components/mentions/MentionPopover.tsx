"use client";

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Transcript } from "@/types";

interface MentionPopoverProps {
  isOpen: boolean;
  searchQuery: string;
  transcripts: Transcript[];
  onSelect: (title: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function MentionPopover({
  isOpen,
  searchQuery,
  transcripts,
  onSelect,
  onClose,
  anchorRef,
}: MentionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredTranscripts = transcripts.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset selection when filter changes
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing derived state (selection index) with search filter
  useEffect(() => { setSelectedIndex(0); }, [searchQuery]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredTranscripts.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredTranscripts[selectedIndex]) {
            onSelect(filteredTranscripts[selectedIndex].title);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, filteredTranscripts, onSelect, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || filteredTranscripts.length === 0) return null;

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-0 mb-2 w-72 rounded-xl border border-border bg-surface shadow-lg z-50 animate-fade-in overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-border">
        <p className="text-xs text-text-tertiary">Mention a transcript</p>
      </div>
      <ScrollArea className="max-h-48">
        <div className="py-1">
          {filteredTranscripts.map((transcript, index) => (
            <button
              key={transcript.id}
              onClick={() => onSelect(transcript.title)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                index === selectedIndex
                  ? "bg-surface-overlay text-text-primary"
                  : "text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
              }`}
            >
              <span className="text-text-faint">@</span>
              {transcript.title}
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
