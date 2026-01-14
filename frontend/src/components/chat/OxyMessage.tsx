"use client";

import type { Message } from "@/types";
import { AnimatedText } from "./AnimatedText";
import { ThinkingSection } from "./ThinkingSection";
import { RadiatingIndicator } from "./RadiatingIndicator";

interface OxyMessageProps {
  message: Message;
  isStreaming?: boolean;
  isThinking?: boolean;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export function OxyMessage({ message, isStreaming = false, isThinking = false }: OxyMessageProps) {
  const showThinking = message.thinking && message.thinking.length > 0;

  return (
    <div className={`oxy-msg oxy-msg-${message.role}`}>
      {message.role === "assistant" && (
        <div className="oxy-msg-indicator">
          {isThinking ? (
            <RadiatingIndicator size={20} />
          ) : (
            <span className={`oxy-dot ${isStreaming ? "oxy-dot-pulse" : ""}`} />
          )}
        </div>
      )}
      <div className="oxy-msg-body">
        {message.role === "assistant" ? (
          <>
            {showThinking && (
              <ThinkingSection
                content={message.thinking || ""}
                isStreaming={isThinking}
                defaultExpanded={isThinking}
              />
            )}
            <div className="oxy-msg-text">
              <AnimatedText content={message.content} isStreaming={isStreaming} />
            </div>
          </>
        ) : (
          <p className="oxy-msg-text">{message.content}</p>
        )}
        <span className="oxy-msg-time">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

export function OxyThinkingIndicator() {
  return (
    <div className="oxy-msg oxy-msg-assistant oxy-thinking">
      <div className="oxy-msg-indicator">
        <RadiatingIndicator size={20} />
      </div>
      <div className="oxy-msg-body">
        <p className="oxy-msg-text oxy-msg-thinking">Thinking</p>
      </div>
    </div>
  );
}
