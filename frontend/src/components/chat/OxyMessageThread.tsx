"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { ChevronDown } from "lucide-react";
import { OxyMessage, OxyThinkingIndicator } from "./OxyMessage";
import type { Message } from "@/types";

interface OxyMessageThreadProps {
  messages: Message[];
  isLoading: boolean;
  isThinking?: boolean;
}

export function OxyMessageThread({ messages, isLoading, isThinking = false }: OxyMessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const isUserScrollingRef = useRef(false);

  // Check if user has scrolled up from the bottom
  const checkScrollPosition = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // Show button if scrolled more than 100px from bottom
    const shouldShow = distanceFromBottom > 100;
    setShowScrollButton(shouldShow);
    isUserScrollingRef.current = shouldShow;
  }, []);

  // Auto-scroll to bottom when new content arrives (unless user has scrolled up)
  useEffect(() => {
    if (!isUserScrollingRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const scrollToBottom = useCallback(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollButton(false);
    isUserScrollingRef.current = false;
  }, []);

  // Find the last assistant message (the one being streamed if isLoading)
  const lastAssistantIndex = messages.findLastIndex((m) => m.role === "assistant");

  return (
    <ScrollArea.Root className="oxy-content">
      <ScrollArea.Viewport
        ref={viewportRef}
        style={{ height: "100%", width: "100%" }}
        onScroll={checkScrollPosition}
      >
        <div className="oxy-thread">
          {messages.map((m, index) => (
            <OxyMessage
              key={m.id}
              message={m}
              isStreaming={isLoading && index === lastAssistantIndex}
              isThinking={isThinking && index === lastAssistantIndex}
            />
          ))}
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
            <OxyThinkingIndicator />
          )}
          <div ref={endRef} />
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
        <ScrollArea.Thumb style={{ background: "var(--gray-200)", borderRadius: 2 }} />
      </ScrollArea.Scrollbar>

      {/* Floating scroll-to-bottom button */}
      {showScrollButton && isLoading && (
        <button
          className="oxy-scroll-to-bottom"
          onClick={scrollToBottom}
          title="Scroll to bottom"
        >
          <ChevronDown size={18} />
          <span>New messages</span>
        </button>
      )}
    </ScrollArea.Root>
  );
}
