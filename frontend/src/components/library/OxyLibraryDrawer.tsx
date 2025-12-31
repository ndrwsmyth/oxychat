"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { formatRelativeDate } from "@/lib/utils";
import type { Transcript } from "@/types";

interface OxyLibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcripts: Transcript[];
  onTranscriptClick: (title: string) => void;
}

export function OxyLibraryDrawer({
  open,
  onOpenChange,
  transcripts,
  onTranscriptClick,
}: OxyLibraryDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="oxy-backdrop" />
        <Dialog.Content className="oxy-library">
          <div className="oxy-library-inner">
            <div className="oxy-library-header">
              <Dialog.Title asChild>
                <span>Transcripts</span>
              </Dialog.Title>
              <Dialog.Close className="oxy-library-close">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </Dialog.Close>
            </div>
            <ScrollArea.Root className="oxy-library-list" style={{ flex: 1 }}>
              <ScrollArea.Viewport style={{ height: "100%", width: "100%" }}>
                {transcripts.length > 0 ? (
                  transcripts.map((t) => (
                    <button
                      key={t.id}
                      className="oxy-library-item"
                      onClick={() => {
                        onTranscriptClick(t.title);
                        onOpenChange(false);
                      }}
                    >
                      <span className="oxy-library-title">{t.title}</span>
                      <span className="oxy-library-when">{formatRelativeDate(t.date)}</span>
                    </button>
                  ))
                ) : (
                  <p style={{ padding: "20px 16px", color: "var(--text-tertiary)", fontSize: "14px" }}>
                    No transcripts yet
                  </p>
                )}
              </ScrollArea.Viewport>
              <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
                <ScrollArea.Thumb style={{ background: "var(--gray-200)", borderRadius: 2 }} />
              </ScrollArea.Scrollbar>
            </ScrollArea.Root>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
