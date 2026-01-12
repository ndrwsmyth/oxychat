"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useTranscriptsPanel } from "@/hooks/useTranscriptsPanel";
import { formatRelativeDate } from "@/lib/utils";
import { X } from "lucide-react";
import type { Transcript } from "@/types";

interface TranscriptsPanelProps {
  transcripts: Transcript[];
  onTranscriptClick: (title: string) => void;
}

export function TranscriptsPanel({
  transcripts,
  onTranscriptClick,
}: TranscriptsPanelProps) {
  const { open, setOpen } = useTranscriptsPanel();

  if (!open) {
    return null;
  }

  return (
    <div className="oxy-transcripts-panel">
      <div className="oxy-transcripts-header">
        <span className="oxy-transcripts-title">Transcripts</span>
        <button
          onClick={() => setOpen(false)}
          className="oxy-transcripts-close"
          aria-label="Close transcripts"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea.Root className="oxy-transcripts-list">
        <ScrollArea.Viewport className="oxy-transcripts-viewport">
          {transcripts.length > 0 ? (
            transcripts.map((t) => (
              <button
                key={t.id}
                className="oxy-transcripts-item"
                onClick={() => {
                  onTranscriptClick(t.title);
                  setOpen(false);
                }}
              >
                <span className="oxy-transcripts-item-title">{t.title}</span>
                <span className="oxy-transcripts-item-date">
                  {formatRelativeDate(t.date)}
                </span>
              </button>
            ))
          ) : (
            <p className="oxy-transcripts-empty">No transcripts yet</p>
          )}
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar
          orientation="vertical"
          className="oxy-transcripts-scrollbar"
        >
          <ScrollArea.Thumb className="oxy-transcripts-thumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}
