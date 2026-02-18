"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Message, ModelOption, ModelMetadata } from "@/types";
import { fetchMessages, fetchModels, streamChat } from "@/lib/api";
import { toast } from "sonner";

interface UseConversationOptions {
  onTitleUpdate?: (title: string, conversationId: string) => void;
}

// Storage key for persisting model selection
const MODEL_STORAGE_KEY = "oxy-chat-model";

const LEGACY_MODEL_MAP: Record<string, string> = {
  "claude-sonnet-4.5": "claude-sonnet-4-6",
  "claude-opus-4.5": "claude-opus-4-6",
};

function normalizeLegacyModel(model: string): string {
  return LEGACY_MODEL_MAP[model] ?? model;
}

function getShortModelLabel(label: string): string {
  if (label.startsWith("Claude ")) {
    return label.replace("Claude ", "");
  }
  return label;
}

export function useConversation(
  conversationId: string | null,
  options: UseConversationOptions = {}
) {
  const { onTitleUpdate } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<ModelOption>("");
  const [defaultModel, setDefaultModel] = useState<ModelOption>("");
  const [models, setModels] = useState<ModelMetadata[]>([]);
  const [isModelsReady, setIsModelsReady] = useState(false);

  // isFetching: loading messages for conversation switch
  // isStreaming: LLM is generating response
  const [isFetching, setIsFetching] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const isLoading = isFetching || isStreaming;
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
  const validModelsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadModels = async () => {
      try {
        const modelData = await fetchModels();
        if (cancelled) return;

        const validModels = new Set(modelData.models.map((m) => m.key));
        validModelsRef.current = validModels;
        setModels(modelData.models);

        const fallbackModel =
          (validModels.has(modelData.defaultModel) ? modelData.defaultModel : modelData.models[0]?.key) ?? "";
        setDefaultModel(fallbackModel);

        const storedRaw = typeof window !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) ?? "" : "";
        const storedModel = normalizeLegacyModel(storedRaw);
        const nextModel = validModels.has(storedModel) ? storedModel : fallbackModel;

        setModel(nextModel);
        if (typeof window !== "undefined" && nextModel) {
          localStorage.setItem(MODEL_STORAGE_KEY, nextModel);
        }
      } catch (err) {
        console.error("[useConversation] Failed to load models:", err);
        const storedRaw = typeof window !== "undefined" ? localStorage.getItem(MODEL_STORAGE_KEY) ?? "" : "";
        const storedModel = normalizeLegacyModel(storedRaw);
        if (storedModel) {
          setModel(storedModel);
          if (typeof window !== "undefined") {
            localStorage.setItem(MODEL_STORAGE_KEY, storedModel);
          }
        }
      } finally {
        if (!cancelled) {
          setIsModelsReady(true);
        }
      }
    };

    loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  const modelOptions = useMemo(
    () =>
      models.map((option) => ({
        value: option.key,
        label: option.label,
        shortLabel: getShortModelLabel(option.label),
      })),
    [models]
  );

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;

    try {
      setIsFetching(true);
      const msgs = await fetchMessages(conversationId);
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setIsFetching(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setError(null);

    if (!conversationId) {
      setMessages([]);
      return;
    }

    // Skip reset if we're transitioning to this conversation (just created it)
    if (isTransitioningRef.current === conversationId) {
      return; // Don't clear ref here - let onComplete handle it
    }

    // Skip loading if we're in the middle of a send operation to avoid race conditions
    if (isSendingRef.current) {
      return;
    }

    // Clear messages on regular conversation switch to prevent flash of old content
    setMessages([]);
    loadMessages();
  }, [conversationId, loadMessages]);

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
    if (!model) {
      toast.error("Model unavailable", {
        description: "Please wait for model settings to load.",
      });
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
    setIsStreaming(true);
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
      onTitleUpdate: (title, convId) => {
        onTitleUpdate?.(title, convId);
      },
      onComplete: () => {
        setIsStreaming(false);
        setIsThinking(false);
        abortControllerRef.current = null;
        isSendingRef.current = false;
        isTransitioningRef.current = null; // Clear transition flag on completion
      },
      onError: (err) => {
        // Show toast instead of setting error state
        toast.error("Failed to send message", {
          description: err.message,
          action: {
            label: "Retry",
            onClick: () => window.location.reload(),
          },
        });
        setError(null);
        setIsStreaming(false);
        setIsThinking(false);
        abortControllerRef.current = null;
        isSendingRef.current = false;
        isTransitioningRef.current = null;
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
    const normalized = normalizeLegacyModel(newModel);
    const validModels = validModelsRef.current;
    const resolvedModel =
      validModels.size > 0
        ? (validModels.has(normalized) ? normalized : defaultModel)
        : normalized;

    if (!resolvedModel) return;

    setModel(resolvedModel);
    // Persist model selection to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem(MODEL_STORAGE_KEY, resolvedModel);
    }
  }, [defaultModel]);

  return {
    messages,
    model,
    modelOptions,
    isModelsReady,
    isLoading,
    isFetching,
    isStreaming,
    isThinking,
    thinkingContent,
    error,
    sendMessage,
    stopGenerating,
    changeModel,
    refresh: loadMessages,
  };
}
