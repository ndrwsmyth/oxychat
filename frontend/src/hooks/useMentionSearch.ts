"use client";

import { useEffect, useRef, useState } from "react";
import {
  queryMentionTranscripts,
  queryMentionDocuments,
  type TranscriptResponse,
  type DocumentMentionResult,
} from "@/lib/api";
import type { Transcript, MentionableItem } from "@/types";

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
  const [items, setItems] = useState<MentionableItem[]>([]);
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
      setItems([]);
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

        const [transcriptResponse, documentResponse] = await Promise.all([
          queryMentionTranscripts(normalizedQuery, {
            projectId,
            conversationId,
            signal: controller.signal,
          }),
          queryMentionDocuments(normalizedQuery, {
            projectId,
            conversationId,
            signal: controller.signal,
          }),
        ]);

        if (sequence !== sequenceRef.current || controller.signal.aborted) {
          return;
        }

        const transcriptList = transcriptResponse.transcripts.map(toTranscript);
        setTranscripts(transcriptList);
        setMode(transcriptResponse.mode);
        setTookMs(transcriptResponse.tookMs);

        // Build merged MentionableItem list: transcripts first, then documents
        const merged: MentionableItem[] = [
          ...transcriptList.map((t) => ({ kind: "transcript" as const, item: t })),
          ...documentResponse.documents.map((d: DocumentMentionResult) => ({
            kind: "document" as const,
            item: {
              id: d.id,
              title: d.title,
              visibility_scope: d.visibility_scope,
              project_id: d.project_id,
              size_bytes: d.size_bytes,
              created_at: d.created_at,
            },
          })),
        ];
        setItems(merged);
      } catch (err) {
        if (controller.signal.aborted || sequence !== sequenceRef.current) {
          return;
        }
        setTranscripts([]);
        setItems([]);
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
    items,
    mode,
    tookMs,
    isLoading,
    error,
  };
}
