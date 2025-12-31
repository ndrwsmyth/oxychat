"use client";

import { useCallback } from "react";
import { EmptyState } from "./EmptyState";
import { MessageThread } from "./MessageThread";
import { ChatInput } from "./ChatInput";
import { useChat } from "@/hooks/useChat";
import type { Transcript } from "@/types";

interface ChatPageProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  transcripts: Transcript[];
}

export function ChatPage({ inputValue, onInputChange, transcripts }: ChatPageProps) {
  const { messages, isLoading, sendMessage } = useChat();

  const hasMessages = messages.length > 0;

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;
    await sendMessage(inputValue);
    onInputChange("");
  }, [inputValue, isLoading, sendMessage, onInputChange]);

  const handlePromptClick = useCallback((prompt: string) => {
    onInputChange(prompt);
  }, [onInputChange]);

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {hasMessages ? (
        <MessageThread messages={messages} isLoading={isLoading} />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <EmptyState onPromptClick={handlePromptClick} />
        </div>
      )}
      <ChatInput
        value={inputValue}
        onChange={onInputChange}
        onSend={handleSend}
        disabled={isLoading}
        transcripts={transcripts}
      />
    </div>
  );
}
