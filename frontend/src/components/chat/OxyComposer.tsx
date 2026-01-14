"use client";

import { useRef, useEffect, useState } from "react";
import { OxyMentionPopover, type MentionPopoverHandle } from "@/components/mentions/OxyMentionPopover";
import { ModelPicker } from "./ModelPicker";
import type { Transcript, ModelOption } from "@/types";
import { Paperclip, Square } from "lucide-react";

interface OxyComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onNewConversation?: () => void;
  disabled: boolean;
  isGenerating?: boolean;
  hasMessages?: boolean;
  transcripts: Transcript[];
  model: ModelOption;
  onModelChange: (model: ModelOption) => void;
}

export function OxyComposer({
  value,
  onChange,
  onSend,
  onStop,
  onNewConversation,
  disabled,
  isGenerating = false,
  hasMessages = false,
  transcripts,
  model,
  onModelChange,
}: OxyComposerProps) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const popoverRef = useRef<MentionPopoverHandle>(null);
  const [focusedInput, setFocusedInput] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");

  // Auto-resize textarea (max 14 lines * 24px = 336px)
  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = "auto";
      const newHeight = Math.min(el.scrollHeight, 336);
      el.style.height = newHeight + "px";

      // Only show scrollbar when content exceeds max height
      el.style.overflowY = el.scrollHeight > 336 ? "auto" : "hidden";
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
    // Forward keyboard events to popover when open
    if (showMentions && popoverRef.current?.handleKeyDown(e)) {
      return; // Event was handled by popover
    }

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
        ref={popoverRef}
        open={showMentions}
        onOpenChange={setShowMentions}
        transcripts={filteredTranscripts}
        onSelect={selectMention}
      >
        <div className={`oxy-composer-unified ${focusedInput ? "focused" : ""}`}>
          {/* Upper Section: Textarea */}
          <div className="oxy-composer-input">
            <textarea
              ref={inputRef}
              value={value}
              onChange={handleInput}
              onKeyDown={onKeyDown}
              onFocus={() => setFocusedInput(true)}
              onBlur={() => setFocusedInput(false)}
              placeholder="Ask anything..."
              className="oxy-textarea"
              rows={1}
            />
          </div>

          {/* Lower Section: Toolbar */}
          <div className="oxy-composer-toolbar">
            <div className="oxy-toolbar-left">
              <ModelPicker
                model={model}
                onModelChange={onModelChange}
                onNewConversation={onNewConversation}
                hasMessages={hasMessages}
                disabled={disabled}
              />
              <button
                className="oxy-attach-btn"
                disabled
                title="Attachments (coming soon)"
              >
                <Paperclip size={18} />
              </button>
            </div>

            <div className="oxy-toolbar-right">
              <span className="oxy-hint">
                <kbd>@</kbd> to cite
              </span>
              {isGenerating ? (
                <button
                  className="oxy-stop"
                  onClick={onStop}
                  title="Stop generating"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  className="oxy-send"
                  onClick={onSend}
                  disabled={!value.trim() || disabled}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M5 12h14" />
                    <path d="M12 5l7 7-7 7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </OxyMentionPopover>
    </div>
  );
}
