"use client";

import { useEffect, useRef, useState } from "react";
import { queryMentionTranscripts, type TranscriptResponse } from "@/lib/api";
import type { Transcript } from "@/types";

const MENTION_SEARCH_DEBOUNCE_MS = 140;

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

export function useMentionSearch(
  query: string,
  projectId?: string,
  conversationId?: string
) {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [mode, setMode] = useState<string>("global_only");
  const [tookMs, setTookMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);

  useEffect(() => {
    const normalizedQuery = query.trim();
    const sequence = ++sequenceRef.current;

    if (!normalizedQuery) {
      setTranscripts([]);
      setMode("global_only");
      setTookMs(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await queryMentionTranscripts(normalizedQuery, {
          projectId,
          conversationId,
          signal: controller.signal,
        });

        if (sequence !== sequenceRef.current || controller.signal.aborted) {
          return;
        }

        setTranscripts(response.transcripts.map(toTranscript));
        setMode(response.mode);
        setTookMs(response.tookMs);
      } catch (err) {
        if (controller.signal.aborted || sequence !== sequenceRef.current) {
          return;
        }
        setTranscripts([]);
        setMode("global_only");
        setTookMs(null);
        setError(err instanceof Error ? err.message : "Failed to search mentions");
      } finally {
        if (!controller.signal.aborted && sequence === sequenceRef.current) {
          setIsLoading(false);
        }
      }
    }, MENTION_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, projectId, conversationId]);

  return {
    transcripts,
    mode,
    tookMs,
    isLoading,
    error,
  };
}
