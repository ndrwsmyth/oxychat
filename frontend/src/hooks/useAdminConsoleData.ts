"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createAdminProject,
  deleteAdminProject,
  fetchAdminClients,
  fetchAdminProjects,
  updateAdminProject,
  type AdminClient,
  type AdminProject,
} from "@/lib/api";

interface CreateProjectInput {
  client_id: string;
  name: string;
  scope?: "personal" | "client" | "global";
  owner_user_id?: string | null;
  is_inbox?: boolean;
  overview_markdown?: string | null;
}

type UpdateProjectInput = Partial<{
  client_id: string;
  name: string;
  scope: "personal" | "client" | "global";
  owner_user_id: string | null;
  is_inbox: boolean;
  overview_markdown: string | null;
}>;

export function useAdminConsoleData() {
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [nextClients, nextProjects] = await Promise.all([
        fetchAdminClients(),
        fetchAdminProjects(),
      ]);
      setClients(nextClients);
      setProjects(nextProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load admin console data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      try {
        setIsMutating(true);
        setError(null);
        await createAdminProject(input);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project");
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [reload]
  );

  const updateProject = useCallback(
    async (projectId: string, input: UpdateProjectInput) => {
      try {
        setIsMutating(true);
        setError(null);
        await updateAdminProject(projectId, input);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update project");
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [reload]
  );

  const removeProject = useCallback(
    async (projectId: string) => {
      try {
        setIsMutating(true);
        setError(null);
        await deleteAdminProject(projectId);
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete project");
        throw err;
      } finally {
        setIsMutating(false);
      }
    },
    [reload]
  );

  return {
    clients,
    projects,
    isLoading,
    isMutating,
    error,
    reload,
    createProject,
    updateProject,
    removeProject,
  };
}
