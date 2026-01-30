"use client";

import * as ScrollArea from "@radix-ui/react-scroll-area";
import { useTranscriptsPanel } from "@/hooks/useTranscriptsPanel";
import { formatRelativeDate } from "@/lib/utils";
import { X, RefreshCw } from "lucide-react";
import type { Transcript } from "@/types";

interface TranscriptsPanelProps {
  transcripts: Transcript[];
  onTranscriptClick: (transcript: { id: string; title: string }) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function TranscriptsPanel({
  transcripts,
  onTranscriptClick,
  isLoading = false,
  onRefresh,
}: TranscriptsPanelProps) {
  const { open, setOpen } = useTranscriptsPanel();

  if (!open) {
    return null;
  }

  return (
    <div className="oxy-transcripts-panel">
      <div className="oxy-transcripts-header">
        <span className="oxy-transcripts-title">Transcripts</span>
        <div className="oxy-transcripts-header-actions">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="oxy-transcripts-refresh"
              aria-label="Refresh transcripts"
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            className="oxy-transcripts-close"
            aria-label="Close transcripts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea.Root className="oxy-transcripts-list">
        <ScrollArea.Viewport className="oxy-transcripts-viewport">
          {isLoading ? (
            <div className="oxy-conversation-group-list">
              {[85, 70, 90, 65, 80].map((width, i) => (
                <div key={i} className="oxy-skeleton-item">
                  <div className="oxy-skeleton oxy-skeleton-text" style={{ width: `${width}%` }} />
                  <div className="oxy-skeleton oxy-skeleton-text" style={{ width: '30%', height: '12px' }} />
                </div>
              ))}
            </div>
          ) : transcripts.length > 0 ? (
            transcripts.map((t) => (
              // TODO: Re-enable click functionality once UX/UI for viewing transcripts is developed
              // Currently disabled - transcripts are display-only until we build the transcript viewer
              <div
                key={t.id}
                className="oxy-transcripts-item"
                // onClick={() => {
                //   onTranscriptClick({ id: t.id, title: t.title });
                //   setOpen(false);
                // }}
              >
                <span className="oxy-transcripts-item-title">{t.title}</span>
                <span className="oxy-transcripts-item-date">
                  {formatRelativeDate(t.date)}
                </span>
              </div>
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
