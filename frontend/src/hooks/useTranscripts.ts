"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchTranscripts, searchTranscripts, TranscriptResponse } from "@/lib/api";
import type { Transcript } from "@/types";

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

  return {
    transcripts,
    isLoading,
    error,
    reload: loadTranscripts,
    search,
  };
}
