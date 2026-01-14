"use client";

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { formatRelativeDate } from "@/lib/utils";
import type { Transcript } from "@/types";

interface OxyMentionPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcripts: Transcript[];
  onSelect: (title: string) => void;
  children: React.ReactNode;
}

export interface MentionPopoverHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const OxyMentionPopover = forwardRef<MentionPopoverHandle, OxyMentionPopoverProps>(
  function OxyMentionPopover(
    { open, onOpenChange, transcripts, onSelect, children },
    ref
  ) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when popover opens or transcripts change
    useEffect(() => {
      if (open) {
        setSelectedIndex(0);
      }
    }, [open, transcripts]);

    const handleSelect = useCallback(
      (title: string) => {
        onSelect(title);
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
              handleSelect(transcripts[selectedIndex].title);
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
            {transcripts.length === 0 ? (
              <div className="oxy-mention-empty">No matching transcripts</div>
            ) : (
              transcripts.map((t, index) => (
                <button
                  key={t.id}
                  className={`oxy-mention ${index === selectedIndex ? "oxy-mention-selected" : ""}`}
                  onClick={() => handleSelect(t.title)}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  <span>{t.title}</span>
                  <span className="oxy-mention-when">{formatRelativeDate(t.date)}</span>
                </button>
              ))
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
