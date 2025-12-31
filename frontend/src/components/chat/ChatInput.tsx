"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MentionPopover } from "@/components/mentions/MentionPopover";
import type { Transcript } from "@/types";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  transcripts?: Transcript[];
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  transcripts = []
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 300)}px`;
    }
  }, [value]);

  // Detect @ mentions
  useEffect(() => {
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const textAfterAt = value.slice(lastAtIndex + 1);
      // Show mention popover if @ is at the end or followed by non-space characters
      if (!textAfterAt.includes(" ")) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  }, [value]);

  const handleMentionSelect = (title: string) => {
    const lastAtIndex = value.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const newValue = value.slice(0, lastAtIndex) + `@${title} `;
      onChange(newValue);
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't process Enter if mention popover is open (it handles its own navigation)
    if (showMentions && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSend();
      }
    }
  };

  return (
    <div className="relative py-4">
      <MentionPopover
        isOpen={showMentions}
        searchQuery={mentionQuery}
        transcripts={transcripts}
        onSelect={handleMentionSelect}
        onClose={() => setShowMentions(false)}
        anchorRef={textareaRef}
      />
      <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-surface-raised px-4 py-3 focus-within:ring-2 focus-within:ring-focus-ring transition-shadow duration-150">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything... (@ to mention transcripts)"
          disabled={disabled}
          rows={1}
          className="flex-1 bg-transparent text-[15px] text-text-primary placeholder:text-text-faint resize-none focus:outline-none disabled:opacity-50 min-h-[24px] max-h-[300px]"
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className="shrink-0 h-8 w-8"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-text-faint">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
