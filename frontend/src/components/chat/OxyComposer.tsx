"use client";

import { useRef, useEffect, useState } from "react";
import { OxyMentionPopover } from "@/components/mentions/OxyMentionPopover";
import type { Transcript } from "@/types";

interface OxyComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  transcripts: Transcript[];
}

export function OxyComposer({
  value,
  onChange,
  onSend,
  disabled,
  transcripts,
}: OxyComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [focusedInput, setFocusedInput] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");

  // Auto-resize textarea
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [value]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    const atIdx = val.lastIndexOf("@");
    if (atIdx !== -1) {
      const after = val.slice(atIdx + 1);
      if (!after.includes(" ") && !after.includes("\n")) {
        setShowMentions(true);
        setMentionFilter(after.toLowerCase());
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (title: string) => {
    const atIdx = value.lastIndexOf("@");
    onChange(value.slice(0, atIdx) + "@" + title + " ");
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
    if (e.key === "Escape") {
      setShowMentions(false);
    }
  };

  const filteredTranscripts = transcripts.filter((t) =>
    t.title.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="oxy-composer">
      <OxyMentionPopover
        open={showMentions}
        onOpenChange={setShowMentions}
        transcripts={filteredTranscripts}
        onSelect={selectMention}
      >
        <div className={`oxy-input-wrap ${focusedInput ? "focused" : ""} ${value.trim() ? "has-text" : ""}`}>
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleInput}
            onKeyDown={onKeyDown}
            onFocus={() => setFocusedInput(true)}
            onBlur={() => setFocusedInput(false)}
            placeholder="Ask anything..."
            rows={1}
          />
          <div className="oxy-input-actions">
            <span className="oxy-hint">
              <kbd>@</kbd> to cite
            </span>
            <button className="oxy-send" onClick={onSend} disabled={!value.trim() || disabled}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </OxyMentionPopover>
    </div>
  );
}
