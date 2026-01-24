"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Message, ModelOption } from "@/types";
import { fetchMessages, streamChat } from "@/lib/api";

interface UseConversationOptions {
  onTitleUpdate?: (title: string) => void;
}

// Storage key for persisting model selection
const MODEL_STORAGE_KEY = "oxy-chat-model";

// Valid model options (must match ModelOption type)
const VALID_MODELS: ModelOption[] = ["claude-sonnet-4.5", "claude-opus-4.5", "gpt-5.2", "grok-4"];

// Get initial model from localStorage or default
function getInitialModel(): ModelOption {
  if (typeof window === "undefined") return "gpt-5.2";
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  if (stored && VALID_MODELS.includes(stored as ModelOption)) {
    return stored as ModelOption;
  }
  return "gpt-5.2";
}

export function useConversation(
  conversationId: string | null,
  _transcripts: any[] = [],
  options: UseConversationOptions = {}
) {
  // Note: _transcripts parameter is kept for API compatibility but currently unused
  const { onTitleUpdate } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<ModelOption>(getInitialModel);
  const [isLoading, setIsLoading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingContent, setThinkingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSendingRef = useRef<boolean>(false);
  // Track conversation transitions to prevent message reset flicker
  const isTransitioningRef = useRef<string | null>(null);
  // Keep messages in a ref to reduce sendMessage dependencies
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    // Skip reset if we're transitioning to this conversation (just created it)
    if (isTransitioningRef.current === conversationId) {
      isTransitioningRef.current = null;
      return;
    }
    // Skip loading if we're in the middle of a send operation to avoid race conditions
    if (isSendingRef.current) {
      return;
    }
    loadMessages();
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
    if (!content.trim()) return;

    // Check ref BEFORE state to prevent race conditions from fast double-clicks.
    // React state batching can cause isLoading to be stale, but refs are synchronous.
    if (isSendingRef.current || isLoading) {
      return;
    }
    isSendingRef.current = true;

    const effectiveConversationId = explicitConversationId || conversationId;
    const isNewConversation = explicitConversationId && explicitConversationId !== conversationId;
    const docIds = mentionIds || [];

    // Mark transition to prevent message reset when URL changes
    if (isNewConversation && effectiveConversationId) {
      isTransitioningRef.current = effectiveConversationId;
    }

    const userMessage: Message = {
      id: crypto.randomUUID(),
      conversation_id: effectiveConversationId || undefined,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => isNewConversation ? [userMessage] : [...prev, userMessage]);
    setIsLoading(true);
    setIsThinking(false);
    setThinkingContent("");
    setError(null);
    abortControllerRef.current = new AbortController();

    // Use messagesRef to avoid stale closure - get current messages from ref
    const baseMessages = isNewConversation ? [] : messagesRef.current;
    const messageHistory = [...baseMessages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

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
      onTitleUpdate: (title) => {
        onTitleUpdate?.(title);
      },
      onComplete: () => {
        setIsLoading(false);
        setIsThinking(false);
        abortControllerRef.current = null;
        isSendingRef.current = false;
      },
      onError: (err) => {
        setError(err.message);
        setIsLoading(false);
        setIsThinking(false);
        abortControllerRef.current = null;
        isSendingRef.current = false;
        // Remove the empty assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      },
    });
  }, [conversationId, isLoading, model, onTitleUpdate]);

  const stopGenerating = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isSendingRef.current = false;
  }, []);

  const changeModel = useCallback((newModel: ModelOption) => {
    setModel(newModel);
    // Persist model selection to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(MODEL_STORAGE_KEY, newModel);
    }
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
