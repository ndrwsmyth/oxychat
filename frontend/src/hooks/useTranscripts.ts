/**
 * Transcripts list management hook.
 */

import { useState, useEffect, useCallback } from "react";
import type { Transcript } from "@/types/chat";
import { fetchTranscripts, uploadTranscript, deleteTranscript } from "@/lib/api";

export function useTranscripts() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTranscripts();
      setTranscripts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load transcripts");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load on mount
  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (title: string, date: string, content: string) => {
      const transcript = await uploadTranscript(title, date, content);
      setTranscripts((prev) => [transcript, ...prev]);
      return transcript;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    await deleteTranscript(id);
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refresh = useCallback(() => {
    return load();
  }, [load]);

  return {
    transcripts,
    isLoading,
    error,
    upload,
    remove,
    refresh,
  };
}
