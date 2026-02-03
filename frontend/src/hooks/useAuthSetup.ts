"use client";

import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setAuthTokenGetter } from "@/lib/api";

/**
 * Hook to wire up Clerk's getToken to the API client.
 * Call this once at the top of your authenticated page/layout.
 */
export function useAuthSetup() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(getToken);
  }, [getToken]);
}
