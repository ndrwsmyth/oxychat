"use client";

import { useState, useEffect, useCallback } from "react";
import type { GroupedConversations, Conversation } from "@/types";
import {
  fetchConversations,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
  deleteConversation as apiDeleteConversation,
  togglePinConversation as apiTogglePinConversation,
} from "@/lib/api";

export function useConversations() {
  const [conversations, setConversations] = useState<GroupedConversations>({
    pinned: [],
    today: [],
    yesterday: [],
    last_7_days: [],
    last_30_days: [],
    older: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchConversations(search);
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const createConversation = useCallback(async (title?: string): Promise<Conversation> => {
    const newConv = await apiCreateConversation(title);
    // Refresh conversations list
    await loadConversations();
    return newConv;
  }, [loadConversations]);

  const updateConversation = useCallback(async (
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> => {
    await apiUpdateConversation(id, updates);
    // Refresh conversations list
    await loadConversations();
  }, [loadConversations]);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    await apiDeleteConversation(id);
    // Refresh conversations list
    await loadConversations();
  }, [loadConversations]);

  const togglePin = useCallback(async (id: string): Promise<void> => {
    await apiTogglePinConversation(id);
    // Refresh conversations list
    await loadConversations();
  }, [loadConversations]);

  const searchConversations = useCallback(async (query: string): Promise<void> => {
    await loadConversations(query);
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    updateConversation,
    deleteConversation,
    togglePin,
    searchConversations,
    refresh: loadConversations,
  };
}
