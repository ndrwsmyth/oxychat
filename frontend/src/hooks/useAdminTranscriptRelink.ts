"use client";

import { useCallback, useState } from "react";
import { relinkAdminTranscript, type AdminTranscriptRelinkResponse } from "@/lib/api";
import { toAdminErrorDisplayMessage } from "@/lib/admin-errors";

export function useAdminTranscriptRelink() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<AdminTranscriptRelinkResponse | null>(null);

  const relink = useCallback(async (transcriptId: string, projectId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await relinkAdminTranscript(transcriptId, projectId);
      setLastResult(result);
      return result;
    } catch (err) {
      const message = toAdminErrorDisplayMessage(err, "Failed to relink transcript");
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    relink,
    isLoading,
    error,
    lastResult,
  };
}
