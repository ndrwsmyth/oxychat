"use client";

import type { Message } from "@/types";

interface OxyMessageProps {
  message: Message;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
}

export function OxyMessage({ message }: OxyMessageProps) {
  return (
    <div className={`oxy-msg oxy-msg-${message.role}`}>
      {message.role === "assistant" && (
        <div className="oxy-msg-indicator">
          <span className="oxy-dot" />
        </div>
      )}
      <div className="oxy-msg-body">
        <p className="oxy-msg-text">{message.content}</p>
        <span className="oxy-msg-time">{formatTime(message.timestamp)}</span>
      </div>
    </div>
  );
}

export function OxyThinkingIndicator() {
  return (
    <div className="oxy-msg oxy-msg-assistant oxy-thinking">
      <div className="oxy-msg-indicator">
        <span className="oxy-dot oxy-dot-pulse" />
      </div>
      <div className="oxy-msg-body">
        <p className="oxy-msg-text oxy-msg-thinking">Searching transcripts</p>
      </div>
    </div>
  );
}
