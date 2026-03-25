"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createAdminProject,
  deleteAdminProject,
  fetchAdminProjects,
  type AdminProject,
  updateAdminProject,
} from "@/lib/api";

export function useAdminProjects() {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const nextProjects = await fetchAdminProjects();
      setProjects(nextProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin projects");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createProject = useCallback(
    async (input: {
      client_id: string;
      name: string;
      scope?: "personal" | "client" | "global";
      owner_user_id?: string | null;
      is_inbox?: boolean;
      overview_markdown?: string | null;
    }) => {
      await createAdminProject(input);
      await reload();
    },
    [reload]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      input: Partial<{
        client_id: string;
        name: string;
        scope: "personal" | "client" | "global";
        owner_user_id: string | null;
        is_inbox: boolean;
        overview_markdown: string | null;
      }>
    ) => {
      await updateAdminProject(projectId, input);
      await reload();
    },
    [reload]
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      await deleteAdminProject(projectId);
      await reload();
    },
    [reload]
  );

  return {
    projects,
    isLoading,
    error,
    reload,
    createProject,
    updateProject,
    removeProject,
  };
}
