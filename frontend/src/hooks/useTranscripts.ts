"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchTranscripts, searchTranscripts, type TranscriptResponse } from "@/lib/api";
import type { Transcript } from "@/types";

interface UseTranscriptsOptions {
  projectId?: string | null;
}

function toTranscript(response: TranscriptResponse): Transcript {
  return {
    id: response.id,
    title: response.title,
    date: new Date(response.date),
    summary: response.summary,
    scope_bucket: response.scope_bucket,
    project_tag: response.project_tag ?? null,
    client_tag: response.client_tag ?? null,
  };
}

export function useTranscripts(options: UseTranscriptsOptions = {}) {
  const { projectId } = options;
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTranscripts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTranscripts(projectId ?? undefined);
      setTranscripts(data.map(toTranscript));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transcripts");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const search = useCallback(async (query: string) => {
    if (!query.trim()) {
      await loadTranscripts();
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const data = await searchTranscripts(query, projectId ?? undefined);
      setTranscripts(data.map(toTranscript));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search transcripts");
    } finally {
      setIsLoading(false);
    }
  }, [loadTranscripts, projectId]);

  // Track if we're in a search state (don't poll during search)
  const isSearchingRef = useRef(false);

  useEffect(() => {
    loadTranscripts();
  }, [loadTranscripts]);

  // Poll every 60 seconds for new transcripts (Supabase Realtime not available)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSearchingRef.current) {
        loadTranscripts();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [loadTranscripts]);

  const searchWithTracking = useCallback(async (query: string) => {
    isSearchingRef.current = !!query.trim();
    await search(query);
  }, [search]);

  return {
    transcripts,
    isLoading,
    error,
    reload: loadTranscripts,
    search: searchWithTracking,
  };
}
