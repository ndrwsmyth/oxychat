/**
 * Mentions search hook for @-mention autocomplete.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import type { Transcript } from "@/types/chat";
import { fetchTranscripts } from "@/lib/api";

export function useMentions() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTranscripts()
      .then(setTranscripts)
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  /**
   * Search transcripts by title.
   * Returns top 10 matches.
   */
  const search = useCallback(
    (query: string): Transcript[] => {
      const q = query.toLowerCase().trim();
      if (!q) {
        return transcripts.slice(0, 10);
      }

      return transcripts
        .filter((t) => t.title.toLowerCase().includes(q))
        .slice(0, 10);
    },
    [transcripts]
  );

  /**
   * Get a transcript by ID.
   */
  const getById = useCallback(
    (id: string): Transcript | undefined => {
      return transcripts.find((t) => t.id === id);
    },
    [transcripts]
  );

  /**
   * Refresh the transcripts list.
   */
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchTranscripts();
      setTranscripts(data);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * All transcripts (for display).
   */
  const all = useMemo(() => transcripts, [transcripts]);

  return {
    transcripts: all,
    isLoading,
    search,
    getById,
    refresh,
  };
}
