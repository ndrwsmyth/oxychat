/**
 * Chat state management hook.
 */

import { useState, useCallback } from "react";
import { v4 as uuid } from "uuid";
import type { Message, TranscriptMention } from "@/types/chat";
import { streamChat } from "@/lib/api";

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string, mentions: TranscriptMention[] = []) => {
      setError(null);

      // Add user message
      const userMessage: Message = {
        id: uuid(),
        role: "user",
        content,
        mentions,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      // Create placeholder for assistant message
      const assistantId = uuid();
      const assistantMessage: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date(),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      try {
        // Build messages for API (all messages in history)
        const apiMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Extract doc_ids from mentions
        const mentionIds = mentions.map((m) => m.id);

        // Stream response
        for await (const chunk of streamChat(apiMessages, mentionIds)) {
          if (chunk.type === "content" && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + chunk.content }
                  : m
              )
            );
          } else if (chunk.type === "done") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, isStreaming: false } : m
              )
            );
          } else if (chunk.type === "error") {
            setError(chunk.error ?? "An error occurred");
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? {
                      ...m,
                      content: `Error: ${chunk.error ?? "An error occurred"}`,
                      isStreaming: false,
                    }
                  : m
              )
            );
          }
          // sources type is handled silently for now
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred";
        setError(errorMessage);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: `Error: ${errorMessage}`, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const retryLastMessage = useCallback(async () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;

    // Remove the last assistant message (the error one)
    setMessages((prev) => {
      const lastIndex = prev.length - 1;
      if (prev[lastIndex]?.role === "assistant") {
        return prev.slice(0, lastIndex);
      }
      return prev;
    });

    // Resend
    await sendMessage(lastUserMessage.content, lastUserMessage.mentions);
  }, [messages, sendMessage]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    retryLastMessage,
  };
}
