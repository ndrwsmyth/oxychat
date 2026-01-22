"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Message, ModelOption } from "@/types";
import { fetchMessages, streamChat } from "@/lib/api";

export function useConversation(
  conversationId: string | null,
  transcripts: any[] = []
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<ModelOption>("gpt-5.2");
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  const sendMessage = useCallback(async (
    content: string,
    explicitConversationId?: string,
    mentionIds?: string[]
  ) => {
    if (!content.trim() || isLoading) return;

    // Use explicit conversationId if provided, otherwise fall back to hook's conversationId
    const effectiveConversationId = explicitConversationId || conversationId;

    // Use passed-in mentionIds directly (extracted from pills in page.tsx)
    const docIds = mentionIds || [];

    // Add user message optimistically
    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: effectiveConversationId || undefined,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsThinking(false);
    setThinkingContent("");
    setError(null);

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    // Build complete message history for API
    const messageHistory = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    // Create assistant message placeholder
    const assistantId = crypto.randomUUID();
    let assistantContent = "";
    let currentThinking = "";

    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        conversation_id: effectiveConversationId || undefined,
        role: "assistant",
        content: "",
        thinking: "",
        timestamp: new Date(),
      },
    ]);

    await streamChat({
      conversationId: effectiveConversationId || undefined,
      messages: messageHistory,
      mentions: docIds,
      model,
      signal: abortControllerRef.current.signal,
      onChunk: (chunk) => {
        assistantContent += chunk;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: assistantContent } : m
          )
        );
      },
      onThinkingStart: () => {
        setIsThinking(true);
        currentThinking = "";
      },
      onThinkingChunk: (chunk) => {
        currentThinking += chunk;
        setThinkingContent(currentThinking);
        // Also store thinking in the message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, thinking: currentThinking } : m
          )
        );
      },
      onThinkingEnd: () => {
        setIsThinking(false);
      },
      onComplete: () => {
        setIsLoading(false);
        setIsThinking(false);
        abortControllerRef.current = null;
      },
      onError: (err) => {
        setError(err.message);
        setIsLoading(false);
        setIsThinking(false);
        abortControllerRef.current = null;
        // Remove the empty assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      },
    });
  }, [conversationId, isLoading, messages, model]);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const changeModel = useCallback((newModel: ModelOption) => {
    setModel(newModel);
  }, []);

  return {
    messages,
    model,
    isLoading,
    isThinking,
    thinkingContent,
    error,
    sendMessage,
    stopGenerating,
    changeModel,
    refresh: loadMessages,
  };
}
