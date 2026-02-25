"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWorkspaces } from "@/lib/api";
import type { WorkspaceTreeClient } from "@/types";

export function useWorkspaces() {
  const [clients, setClients] = useState<WorkspaceTreeClient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const payload = await fetchWorkspaces();
      setClients(payload.clients ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workspaces");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    clients,
    isLoading,
    error,
    reload,
  };
}
