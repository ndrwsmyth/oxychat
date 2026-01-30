"use client";

import { useState } from "react";
import type { Message } from "@/types";
import { AnimatedText } from "./AnimatedText";
import { ThinkingSection } from "./ThinkingSection";
import { RadiatingIndicator } from "./RadiatingIndicator";
import { MessageActions } from "./MessageActions";

interface OxyMessageProps {
  message: Message;
  isStreaming?: boolean;
  isThinking?: boolean;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

function renderUserContent(content: string): React.ReactNode {
  const mentionRegex = /@\[([^\]]+)\]/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={lastIndex} className="oxy-user-mention-pill">
        @{match[1]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex === 0) {
    return content;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

export function OxyMessage({ message, isStreaming = false, isThinking = false }: OxyMessageProps) {
  const showThinking = message.thinking && message.thinking.length > 0;
  const [isHovered, setIsHovered] = useState(false);

  // Show actions only for assistant messages that are not currently streaming/thinking
  const showActions =
    message.role === "assistant" && !isStreaming && !isThinking && message.id;

  return (
    <div
      className={`oxy-msg oxy-msg-${message.role}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {message.role === "assistant" && (
        <div className="oxy-msg-indicator">
          {(isStreaming || isThinking) && (
            isThinking ? (
              <RadiatingIndicator size={24} />
            ) : (
              <span className="oxy-dot oxy-dot-pulse" />
            )
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
            {showActions && (
              <MessageActions
                messageId={message.id}
                content={message.content}
                visible={isHovered}
              />
            )}
          </>
        ) : (
          <p className="oxy-msg-text">{renderUserContent(message.content)}</p>
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
        <RadiatingIndicator size={24} />
      </div>
      <div className="oxy-msg-body">
        <p className="oxy-msg-text oxy-msg-thinking">Thinking</p>
      </div>
    </div>
  );
}
