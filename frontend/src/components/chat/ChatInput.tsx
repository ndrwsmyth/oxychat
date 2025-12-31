/**
 * Chat input with @-mention support.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MentionPopover } from "./MentionPopover";
import { Send, Loader2 } from "lucide-react";
import type { Transcript, TranscriptMention } from "@/types/chat";
import { useMentions } from "@/hooks/useMentions";

interface ChatInputProps {
  onSend: (content: string, mentions: TranscriptMention[]) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const [mentions, setMentions] = useState<TranscriptMention[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const { transcripts } = useMentions();

  // Handle input changes
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const cursorPos = e.target.selectionStart;
    setValue(text);

    // Check for @ trigger
    if (text[cursorPos - 1] === "@") {
      setShowMentions(true);
      setMentionStartPos(cursorPos - 1);
      setMentionQuery("");
    } else if (showMentions && mentionStartPos !== null) {
      // Update query while mention popover is open
      const query = text.slice(mentionStartPos + 1, cursorPos);

      // Close if space or newline after @
      if (query.includes(" ") || query.includes("\n")) {
        setShowMentions(false);
        setMentionStartPos(null);
      } else {
        setMentionQuery(query);
      }
    }
  };

  // Handle mention selection
  const handleMentionSelect = useCallback(
    (transcript: Transcript) => {
      if (mentionStartPos === null) return;

      const cursorPos = textareaRef.current?.selectionStart ?? value.length;

      // Replace @query with @title
      const before = value.slice(0, mentionStartPos);
      const after = value.slice(cursorPos);
      const mentionText = `@${transcript.title} `;

      const newValue = before + mentionText + after;
      setValue(newValue);

      // Add to mentions list
      const mention: TranscriptMention = {
        id: transcript.id,
        title: transcript.title,
        position: mentionStartPos,
      };
      setMentions((prev) => [...prev, mention]);

      // Close popover
      setShowMentions(false);
      setMentionStartPos(null);

      // Focus textarea and set cursor after mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newPos = before.length + mentionText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
    },
    [mentionStartPos, value]
  );

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }

    // Close popover on Escape
    if (e.key === "Escape" && showMentions) {
      setShowMentions(false);
      setMentionStartPos(null);
    }
  };

  // Handle send
  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;

    onSend(trimmed, mentions);
    setValue("");
    setMentions([]);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [value]);

  return (
    <div className="border-t bg-background p-4">
      <div className="max-w-3xl mx-auto relative">
        {/* Mention popover anchor */}
        <div ref={anchorRef} className="absolute bottom-full left-0 w-full" />

        <MentionPopover
          open={showMentions}
          onOpenChange={setShowMentions}
          query={mentionQuery}
          transcripts={transcripts}
          onSelect={handleMentionSelect}
          anchorRef={anchorRef}
        />

        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything... Use @ to mention transcripts"
            className="min-h-[44px] max-h-[200px] resize-none flex-1"
            disabled={disabled}
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            size="icon"
            className="shrink-0"
          >
            {disabled ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Show selected mentions */}
        {mentions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {mentions.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground"
              >
                @{m.title}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
