"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { submitMessageFeedback, type FeedbackType } from "@/lib/api";

interface MessageActionsProps {
  messageId: string;
  content: string;
  visible: boolean;
  initialFeedback?: FeedbackType;
}

export function MessageActions({
  messageId,
  content,
  visible,
  initialFeedback = null,
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackType>(initialFeedback);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  }, [content]);

  const handleFeedback = useCallback(
    async (type: "positive" | "negative") => {
      if (isSubmitting) return;

      // Toggle off if same feedback clicked again
      const newFeedback = feedback === type ? null : type;

      // Optimistic update
      setFeedback(newFeedback);
      setIsSubmitting(true);

      try {
        await submitMessageFeedback(messageId, newFeedback);
      } catch (err) {
        // Revert on error
        setFeedback(feedback);
        console.error("Failed to submit feedback:", err);
      } finally {
        setIsSubmitting(false);
      }
    },
    [messageId, feedback, isSubmitting]
  );

  return (
    <div className={`oxy-msg-actions ${visible ? "visible" : ""}`}>
      <button
        type="button"
        className="oxy-msg-action-btn"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy message"}
        tabIndex={0}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <button
        type="button"
        className={`oxy-msg-action-btn ${feedback === "positive" ? "active" : ""}`}
        onClick={() => handleFeedback("positive")}
        aria-label="Good response"
        aria-pressed={feedback === "positive"}
        tabIndex={0}
        disabled={isSubmitting}
      >
        <ThumbsUp size={14} />
      </button>
      <button
        type="button"
        className={`oxy-msg-action-btn ${feedback === "negative" ? "active" : ""}`}
        onClick={() => handleFeedback("negative")}
        aria-label="Bad response"
        aria-pressed={feedback === "negative"}
        tabIndex={0}
        disabled={isSubmitting}
      >
        <ThumbsDown size={14} />
      </button>
    </div>
  );
}
