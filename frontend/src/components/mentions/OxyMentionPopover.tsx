"use client";

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

export function OxyMentionPopover({
  open,
  onOpenChange,
  transcripts,
  onSelect,
  children,
}: OxyMentionPopoverProps) {
  if (transcripts.length === 0) {
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
          {transcripts.map((t) => (
            <button
              key={t.id}
              className="oxy-mention"
              onClick={() => onSelect(t.title)}
            >
              <span>{t.title}</span>
              <span className="oxy-mention-when">{formatRelativeDate(t.date)}</span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
