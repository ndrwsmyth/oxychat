"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, ModelOption } from "@/types";
import { fetchMessages, streamChat, parseMentions } from "@/lib/api";

export function useConversation(
  conversationId: string | null,
  transcripts: any[] = []
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<ModelOption>("claude-sonnet-4.5");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      const msgs = await fetchMessages(conversationId);
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Parse @mentions and resolve to doc_ids
    const mentionTitles = parseMentions(content);
    const docIds = mentionTitles
      .map(title => transcripts.find((t: any) => t.title === title)?.id)
      .filter((id): id is string => Boolean(id));

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversationId || undefined,
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
        conversation_id: conversationId || undefined,
        role: "assistant",
        content: "",
        timestamp: new Date(),
      },
    ]);

    await streamChat({
      conversationId: conversationId || undefined,
      messages: messageHistory,
      mentions: docIds,
      model,
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
  }, [conversationId, isLoading, messages, model, transcripts]);

  const changeModel = useCallback((newModel: ModelOption) => {
    setModel(newModel);
  }, []);

  return {
    messages,
    model,
    isLoading,
    error,
    sendMessage,
    changeModel,
    refresh: loadMessages,
  };
}
