"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { GroupedConversations, Conversation } from "@/types";
import {
  fetchConversations,
  createConversation as apiCreateConversation,
  updateConversation as apiUpdateConversation,
  deleteConversation as apiDeleteConversation,
  togglePinConversation as apiTogglePinConversation,
} from "@/lib/api";

type GroupKey = keyof GroupedConversations;

const GROUP_KEYS: GroupKey[] = ['pinned', 'today', 'yesterday', 'two_days_ago', 'last_7_days', 'last_week', 'older'];

function findConversationGroup(
  conversations: GroupedConversations,
  id: string
): { group: GroupKey; index: number } | null {
  for (const group of GROUP_KEYS) {
    const index = conversations[group].findIndex(c => c.id === id);
    if (index !== -1) return { group, index };
  }
  return null;
}

function removeFromGroup(
  conversations: GroupedConversations,
  id: string
): GroupedConversations {
  const result = { ...conversations };
  for (const group of GROUP_KEYS) {
    result[group] = conversations[group].filter(c => c.id !== id);
  }
  return result;
}

interface UseConversationsOptions {
  projectId?: string | null;
}

export function useConversations(options: UseConversationsOptions = {}) {
  const { projectId } = options;
  const [conversations, setConversations] = useState<GroupedConversations>({
    pinned: [],
    today: [],
    yesterday: [],
    two_days_ago: [],
    last_7_days: [],
    last_week: [],
    older: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequenceRef = useRef(0);
  const activeProjectRef = useRef<string | null>(projectId ?? null);

  const loadConversations = useCallback(async (search?: string, scopedProjectId?: string | null) => {
    const requestId = ++requestSequenceRef.current;
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchConversations(search, scopedProjectId ?? undefined);
      if (requestId !== requestSequenceRef.current) {
        return;
      }
      setConversations(data);
    } catch (err) {
      if (requestId !== requestSequenceRef.current) {
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      if (requestId === requestSequenceRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Load conversations on mount and project scope changes
  useEffect(() => {
    const nextProjectId = projectId ?? null;
    activeProjectRef.current = nextProjectId;
    loadConversations(undefined, nextProjectId);
  }, [loadConversations, projectId]);

  const createConversation = useCallback(async (
    title?: string,
    model?: string,
    scopedProjectId?: string | null
  ): Promise<Conversation> => {
    const effectiveProjectId = scopedProjectId ?? activeProjectRef.current ?? undefined;
    const newConv = await apiCreateConversation(title, model, effectiveProjectId ?? undefined);
    if (effectiveProjectId && newConv.project_id !== effectiveProjectId) {
      return newConv;
    }
    setConversations(prev => ({
      ...prev,
      today: [newConv, ...prev.today],
    }));
    return newConv;
  }, []);

  const updateConversation = useCallback(async (
    id: string,
    updates: Partial<Conversation>
  ): Promise<void> => {
    // Find current conversation
    const location = findConversationGroup(conversations, id);
    if (!location) {
      await apiUpdateConversation(id, updates);
      await loadConversations(undefined, activeProjectRef.current);
      return;
    }

    const { group, index } = location;
    const original = conversations[group][index];

    // Optimistically update
    setConversations(prev => ({
      ...prev,
      [group]: prev[group].map(c =>
        c.id === id ? { ...c, ...updates, updated_at: new Date() } : c
      ),
    }));

    try {
      await apiUpdateConversation(id, updates);
      // No need to refetch - optimistic update already applied
    } catch (err) {
      // Rollback on error
      setConversations(prev => ({
        ...prev,
        [group]: prev[group].map(c =>
          c.id === id ? original : c
        ),
      }));
      throw err;
    }
  }, [conversations, loadConversations]);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    // Find and save for rollback
    const location = findConversationGroup(conversations, id);
    const original = location ? conversations[location.group][location.index] : null;

    // Optimistically remove
    setConversations(prev => removeFromGroup(prev, id));

    try {
      await apiDeleteConversation(id);
    } catch (err) {
      // Rollback on error
      if (original && location) {
        setConversations(prev => ({
          ...prev,
          [location.group]: [
            ...prev[location.group].slice(0, location.index),
            original,
            ...prev[location.group].slice(location.index),
          ],
        }));
      }
      throw err;
    }
  }, [conversations]);

  const togglePin = useCallback(async (id: string): Promise<void> => {
    const location = findConversationGroup(conversations, id);
    if (!location) {
      await apiTogglePinConversation(id);
      await loadConversations();
      return;
    }

    const { group, index } = location;
    const conv = conversations[group][index];
    const wasPinned = conv.pinned;
    const now = new Date();

    // Optimistically move between pinned and original group
    setConversations(prev => {
      const updated = removeFromGroup(prev, id);
      const updatedConv = {
        ...conv,
        pinned: !wasPinned,
        pinned_at: wasPinned ? null : now,
      };

      if (wasPinned) {
        // Move from pinned to today (most recent)
        return { ...updated, today: [updatedConv, ...updated.today] };
      } else {
        // Move to pinned
        return { ...updated, pinned: [...updated.pinned, updatedConv] };
      }
    });

    try {
      await apiTogglePinConversation(id);
      // Trust optimistic update on success - no refetch needed
    } catch (err) {
      // Rollback on error - refetch full state
      await loadConversations(undefined, activeProjectRef.current);
      throw err;
    }
  }, [conversations, loadConversations]);

  const searchConversations = useCallback((search?: string) => {
    return loadConversations(search, activeProjectRef.current);
  }, [loadConversations]);

  /**
   * Optimistically update a conversation's title in the sidebar.
   * Used when title_update SSE event is received to avoid full refetch.
   */
  const updateConversationTitle = useCallback((id: string, title: string) => {
    setConversations(prev => {
      const result = { ...prev };
      for (const group of GROUP_KEYS) {
        result[group] = prev[group].map(c =>
          c.id === id ? { ...c, title, auto_titled: true } : c
        );
      }
      return result;
    });
  }, []);

  return {
    conversations,
    isLoading,
    error,
    createConversation,
    updateConversation,
    updateConversationTitle,
    deleteConversation,
    togglePin,
    searchConversations,
    refresh: () => loadConversations(undefined, activeProjectRef.current),
  };
}
