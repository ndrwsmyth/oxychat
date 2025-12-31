"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "./Message";
import { ThinkingIndicator } from "./ThinkingIndicator";
import type { Message as MessageType } from "@/types";

interface MessageThreadProps {
  messages: MessageType[];
  isLoading: boolean;
}

export function MessageThread({ messages, isLoading }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <ScrollArea className="flex-1 pr-4">
      <div className="flex flex-col gap-6 py-6">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
        {isLoading && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
