"use client";

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { formatRelativeDate } from "@/lib/utils";
import type { Transcript } from "@/types";

interface OxyMentionPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcripts: Transcript[];
  isLoading?: boolean;
  onSelect: (transcript: Transcript) => void;
  children: React.ReactNode;
}

export interface MentionPopoverHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const OxyMentionPopover = forwardRef<MentionPopoverHandle, OxyMentionPopoverProps>(
  function OxyMentionPopover(
    { open, onOpenChange, transcripts, isLoading = false, onSelect, children },
    ref
  ) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Reset selection when popover opens or transcripts change
    useEffect(() => {
      if (open) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing selection index with popover open state
        setSelectedIndex(0);
        itemRefs.current = [];
      }
    }, [open, transcripts]);

    // Auto-scroll selected item into view when selection changes
    useEffect(() => {
      if (!open || transcripts.length === 0) return;
      
      const selectedItem = itemRefs.current[selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({
          behavior: "auto",
          block: "nearest",
        });
      }
    }, [selectedIndex, open, transcripts.length]);

    const handleSelect = useCallback(
      (transcript: Transcript) => {
        onSelect(transcript);
        onOpenChange(false);
      },
      [onSelect, onOpenChange]
    );

    // Keyboard navigation handler - returns true if event was handled
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent): boolean => {
        if (!open || transcripts.length === 0) return false;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % transcripts.length);
            return true;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + transcripts.length) % transcripts.length);
            return true;
          case "Enter":
            e.preventDefault();
            if (transcripts[selectedIndex]) {
              handleSelect(transcripts[selectedIndex]);
            }
            return true;
          case "Escape":
            e.preventDefault();
            onOpenChange(false);
            return true;
          case "Tab":
            // Close on tab
            onOpenChange(false);
            return false;
          default:
            return false;
        }
      },
      [open, transcripts, selectedIndex, handleSelect, onOpenChange]
    );

    // Expose handleKeyDown to parent via ref
    useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown]);

    if (transcripts.length === 0 && !open) {
      return <>{children}</>;
    }

    return (
      <Popover.Root open={open} onOpenChange={onOpenChange}>
        <Popover.Anchor asChild>{children}</Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            className="oxy-mentions"
            side="top"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            avoidCollisions={true}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            {isLoading && transcripts.length === 0 ? (
              <div className="oxy-mention-empty">Searching transcripts…</div>
            ) : transcripts.length === 0 ? (
              <div className="oxy-mention-empty">No matching transcripts</div>
            ) : (
              transcripts.map((t, index) => (
                <button
                  key={t.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={`oxy-mention ${index === selectedIndex ? "oxy-mention-selected" : ""}`}
                  onClick={() => handleSelect(t)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span className="oxy-mention-title">{t.title}</span>
                  <span className="oxy-mention-meta">
                    {t.scope_bucket ? (
                      <span className={`oxy-mention-badge oxy-mention-badge-${t.scope_bucket}`}>
                        {t.scope_bucket === "project" ? "Project" : "Global"}
                      </span>
                    ) : null}
                    <span className="oxy-mention-when">{formatRelativeDate(t.date)}</span>
                  </span>
                </button>
              ))
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
