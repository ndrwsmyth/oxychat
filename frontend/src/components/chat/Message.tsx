"use client";

import { useState } from "react";
import { formatRelativeDate } from "@/lib/utils";
import type { Message as MessageType } from "@/types";

interface MessageProps {
  message: MessageType;
}

export function Message({ message }: MessageProps) {
  const [showTimestamp, setShowTimestamp] = useState(false);
  const isUser = message.role === "user";

  return (
    <div
      className={`group flex flex-col gap-1 animate-fade-up ${
        isUser ? "items-end" : "items-start"
      }`}
      onMouseEnter={() => setShowTimestamp(true)}
      onMouseLeave={() => setShowTimestamp(false)}
    >
      <div
        className={`max-w-[85%] ${
          isUser
            ? "text-text-secondary"
            : "text-text-primary"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-text-primary animate-dot-pulse" />
          </div>
        )}
        <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.content}
        </p>
      </div>
      <span
        className={`text-xs text-text-faint transition-opacity duration-150 ${
          showTimestamp ? "opacity-100" : "opacity-0"
        }`}
      >
        {formatRelativeDate(message.timestamp)}
      </span>
    </div>
  );
}
