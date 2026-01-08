"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchDraft, saveDraft as apiSaveDraft } from "@/lib/api";

export function useDraft(conversationId: string | null) {
  const [draft, setDraft] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Load draft when conversation changes
  useEffect(() => {
    if (conversationId) {
      loadDraft();
    } else {
      setDraft("");
    }
  }, [conversationId]);

  const loadDraft = useCallback(async () => {
    if (!conversationId) return;

    try {
      const content = await fetchDraft(conversationId);
      setDraft(content);
    } catch (err) {
      // Silently fail - draft is optional
      setDraft("");
    }
  }, [conversationId]);

  // Auto-save draft with debouncing (500ms)
  useEffect(() => {
    if (!conversationId || !draft) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      try {
        await apiSaveDraft(conversationId, draft);
      } catch (err) {
        // Silently fail - draft is optional
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => {
      clearTimeout(timer);
      setIsSaving(false);
    };
  }, [draft, conversationId]);

  return { draft, setDraft, isSaving };
}
