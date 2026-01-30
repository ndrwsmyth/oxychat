"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeCallbacks {
  onInsert?: (data: Record<string, unknown>) => void;
  onUpdate?: (data: Record<string, unknown>) => void;
  onDelete?: (data: Record<string, unknown>) => void;
}

/**
 * Subscribe to real-time changes on the meetings table via Supabase Realtime.
 * Gracefully skips if Supabase is not configured.
 */
export function useTranscriptRealtime(callbacks: RealtimeCallbacks) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef(callbacks);

  // Keep callbacks ref updated to avoid re-subscribing on callback changes
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    if (!supabase) {
      console.log("[Realtime] Supabase not configured, skipping subscription");
      return;
    }

    // Capture reference for cleanup function
    const client = supabase;

    console.log("[Realtime] Subscribing to transcripts table changes");

    const channel = client
      .channel("transcripts-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transcripts" },
        (payload) => {
          console.log(`[Realtime] Change received: ${payload.eventType}`);

          if (payload.eventType === "INSERT") {
            callbacksRef.current.onInsert?.(payload.new);
          }
          if (payload.eventType === "UPDATE") {
            callbacksRef.current.onUpdate?.(payload.new);
          }
          if (payload.eventType === "DELETE") {
            callbacksRef.current.onDelete?.(payload.old);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[Realtime] Subscription status: ${status}`);
      });

    channelRef.current = channel;

    return () => {
      console.log("[Realtime] Cleaning up subscription");
      client.removeChannel(channel);
    };
  }, []);
}
