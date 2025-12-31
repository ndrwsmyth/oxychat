"use client";

import { useState, useCallback } from "react";
import { streamChat, parseMentions } from "@/lib/api";
import type { Message } from "@/types";
import type { TranscriptResponse } from "@/lib/api";

export function useChat(transcripts: TranscriptResponse[]) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Parse @mentions and resolve to doc_ids
    const mentionTitles = parseMentions(content);
    const docIds = mentionTitles
      .map(title => transcripts.find(t => t.title === title)?.id)
      .filter((id): id is string => Boolean(id));

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    // Build complete message history for API
    const messageHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID();
    let assistantContent = "";

    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);

    await streamChat({
      messages: messageHistory,
      mentions: docIds,
      onChunk: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      },
      onComplete: () => {
        setIsLoading(false);
      },
      onError: (err) => {
        setError(err.message);
        setIsLoading(false);
        // Remove the empty assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      },
    });
  }, [isLoading, messages, transcripts]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
  };
}
