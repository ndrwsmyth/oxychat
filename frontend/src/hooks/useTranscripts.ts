"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchTranscripts, searchTranscripts, TranscriptResponse } from "@/lib/api";
import type { Transcript } from "@/types";
import { useTranscriptRealtime } from "./useTranscriptRealtime";
import { toast } from "sonner";

function toTranscript(response: TranscriptResponse): Transcript {
  return {
    id: response.id,
    title: response.title,
    date: new Date(response.date),
    summary: response.summary,
  };
}

export function useTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTranscripts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTranscripts();
      setTranscripts(data.map(toTranscript));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transcripts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      await loadTranscripts();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await searchTranscripts(query);
      setTranscripts(data.map(toTranscript));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search transcripts");
    } finally {
      setIsLoading(false);
    }
  }, [loadTranscripts]);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  // Real-time subscription callbacks
  const realtimeCallbacks = useMemo(
    () => ({
      onInsert: (data: Record<string, unknown>) => {
        const title = (data.title as string) || "New transcript";
        toast.success(`New transcript: ${title}`);
        loadTranscripts();
      },
      onUpdate: () => {
        loadTranscripts();
      },
    }),
    [loadTranscripts]
  );

  // Subscribe to real-time updates from Supabase
  useTranscriptRealtime(realtimeCallbacks);

  return {
    transcripts,
    isLoading,
    error,
    reload: loadTranscripts,
    search,
  };
}
