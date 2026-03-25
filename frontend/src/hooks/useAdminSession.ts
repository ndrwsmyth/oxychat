"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAdminSession, type AdminSessionResponse } from "@/lib/api";

interface AdminSessionError {
  message: string;
  code?: string;
  status?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useAdminSession() {
  const [session, setSession] = useState<AdminSessionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AdminSessionError | null>(null);

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setIsLoading(true);
      const nextSession = await fetchAdminSession();
      setSession(nextSession);
      setError(null);
    } catch (err) {
      const candidate =
        err instanceof Error
          ? (err as Error & { code?: string; status?: number })
          : null;

      // Clerk token hydration can race first request on fresh load.
      // Retry once so admin affordances do not disappear until focus refresh.
      if (candidate?.status === 401) {
        try {
          await sleep(250);
          const retrySession = await fetchAdminSession();
          setSession(retrySession);
          setError(null);
          return;
        } catch (retryErr) {
          const retryCandidate =
            retryErr instanceof Error
              ? (retryErr as Error & { code?: string; status?: number })
              : null;
          setSession(null);
          setError({
            message: retryCandidate?.message ?? "Failed to load admin session",
            code: retryCandidate?.code,
            status: retryCandidate?.status,
          });
          return;
        }
      }

      setSession(null);
      setError({
        message: candidate?.message ?? "Failed to load admin session",
        code: candidate?.code,
        status: candidate?.status,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const handleFocus = () => {
      if (sessionRef.current) {
        void reload({ silent: true });
      } else {
        void reload();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [reload]);

  return {
    session,
    role: session?.role ?? null,
    isAdmin: session?.role === "admin",
    isLoading,
    error,
    reload,
  };
}
