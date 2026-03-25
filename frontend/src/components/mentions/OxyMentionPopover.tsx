"use client";

import { useState, useEffect, useCallback, useImperativeHandle, forwardRef, useRef } from "react";
import * as Popover from "@radix-ui/react-popover";
import { formatRelativeDate } from "@/lib/utils";
import type { Transcript, MentionableItem } from "@/types";

interface OxyMentionPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transcripts: Transcript[];
  items?: MentionableItem[];
  isLoading?: boolean;
  onSelect: (transcript: Transcript) => void;
  onSelectItem?: (item: MentionableItem) => void;
  children: React.ReactNode;
}

export interface MentionPopoverHandle {
  handleKeyDown: (e: React.KeyboardEvent) => boolean;
}

export const OxyMentionPopover = forwardRef<MentionPopoverHandle, OxyMentionPopoverProps>(
  function OxyMentionPopover(
    { open, onOpenChange, transcripts, items, isLoading = false, onSelect, onSelectItem, children },
    ref
  ) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    // Use items if provided, otherwise fall back to transcripts-only
    const allItems: MentionableItem[] = items ??
      transcripts.map((t) => ({ kind: "transcript" as const, item: t }));

    // Reset selection when popover opens or items change
    useEffect(() => {
      if (open) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizing selection index with popover open state
        setSelectedIndex(0);
        itemRefs.current = [];
      }
    }, [open, allItems.length]);

    // Auto-scroll selected item into view when selection changes
    useEffect(() => {
      if (!open || allItems.length === 0) return;

      const selectedItem = itemRefs.current[selectedIndex];
      if (selectedItem) {
        selectedItem.scrollIntoView({
          behavior: "auto",
          block: "nearest",
        });
      }
    }, [selectedIndex, open, allItems.length]);

    const handleSelectItem = useCallback(
      (item: MentionableItem) => {
        if (onSelectItem) {
          onSelectItem(item);
        } else if (item.kind === "transcript") {
          onSelect(item.item);
        }
        onOpenChange(false);
      },
      [onSelect, onSelectItem, onOpenChange]
    );

    // Keep legacy onSelect path for backward compatibility
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
        if (!open || allItems.length === 0) return false;

        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % allItems.length);
            return true;
          case "ArrowUp":
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + allItems.length) % allItems.length);
            return true;
          case "Enter":
            e.preventDefault();
            if (allItems[selectedIndex]) {
              handleSelectItem(allItems[selectedIndex]);
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
      [open, allItems, selectedIndex, handleSelectItem, onOpenChange]
    );

    // Expose handleKeyDown to parent via ref
    useImperativeHandle(ref, () => ({ handleKeyDown }), [handleKeyDown]);

    if (allItems.length === 0 && !open) {
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
            {isLoading && allItems.length === 0 ? (
              <div className="oxy-mention-empty">Searching…</div>
            ) : allItems.length === 0 ? (
              <div className="oxy-mention-empty">No results</div>
            ) : (
              allItems.map((mentionItem, index) => {
                if (mentionItem.kind === "transcript") {
                  const t = mentionItem.item;
                  return (
                    <button
                      key={t.id}
                      ref={(el) => { itemRefs.current[index] = el; }}
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
                  );
                }

                // Document item
                const d = mentionItem.item;
                return (
                  <button
                    key={`doc:${d.id}`}
                    ref={(el) => { itemRefs.current[index] = el; }}
                    className={`oxy-mention ${index === selectedIndex ? "oxy-mention-selected" : ""}`}
                    onClick={() => handleSelectItem(mentionItem)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="oxy-mention-title">{d.title}</span>
                    <span className="oxy-mention-meta">
                      <span className="oxy-mention-badge oxy-mention-badge-doc">
                        Doc
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
);
