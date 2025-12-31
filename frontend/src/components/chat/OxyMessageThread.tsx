"use client";

import { useEffect, useRef } from "react";
import * as ScrollArea from "@radix-ui/react-scroll-area";
import { OxyMessage, OxyThinkingIndicator } from "./OxyMessage";
import type { Message } from "@/types";

interface OxyMessageThreadProps {
  messages: Message[];
  isLoading: boolean;
}

export function OxyMessageThread({ messages, isLoading }: OxyMessageThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <ScrollArea.Root className="oxy-content">
      <ScrollArea.Viewport style={{ height: "100%", width: "100%" }}>
        <div className="oxy-thread">
          {messages.map((m) => (
            <OxyMessage key={m.id} message={m} />
          ))}
          {isLoading && <OxyThinkingIndicator />}
          <div ref={endRef} />
        </div>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" style={{ width: 4 }}>
        <ScrollArea.Thumb style={{ background: "var(--gray-200)", borderRadius: 2 }} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}
