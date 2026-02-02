import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";

interface UseTypewriterOptions {
  speed?: number; // ms per character (default: 35)
  enabled?: boolean; // whether to animate (default: true)
}

/**
 * Animates text changes character-by-character with a typewriter effect.
 *
 * @param targetText - The final text to display
 * @param options - Configuration for animation speed and enabling
 * @returns The current display string (animated or final)
 *
 * Behavior:
 * - When target changes from null/empty/"Untitled" to a real title → animates
 * - When target already has value and changes → snaps to new value (no animation)
 * - Returns current display string as characters are revealed
 */
export function useTypewriter(
  targetText: string,
  options: UseTypewriterOptions = {}
): string {
  const { speed = 35, enabled = true } = options;

  // Use refs to track animation state without triggering re-renders
  const storeRef = useRef({
    displayedText: targetText,
    prevTarget: null as string | null,
    index: targetText.length,
    intervalId: null as ReturnType<typeof setInterval> | null,
    listeners: new Set<() => void>(),
  });

  // Subscribe function for useSyncExternalStore
  const subscribe = useCallback((listener: () => void) => {
    storeRef.current.listeners.add(listener);
    return () => storeRef.current.listeners.delete(listener);
  }, []);

  // Snapshot function for useSyncExternalStore
  const getSnapshot = useCallback(() => storeRef.current.displayedText, []);

  // Notify all listeners of state change
  const notifyListeners = useCallback(() => {
    storeRef.current.listeners.forEach((listener) => listener());
  }, []);

  // Handle target text changes
  useEffect(() => {
    const store = storeRef.current;
    const prevTarget = store.prevTarget;
    store.prevTarget = targetText;

    // Clear any existing interval
    if (store.intervalId) {
      clearInterval(store.intervalId);
      store.intervalId = null;
    }

    // Determine if we should animate
    const wasEmpty = !prevTarget || prevTarget === "Untitled";
    const isNowFilled = targetText && targetText !== "Untitled";
    const shouldAnimate = enabled && wasEmpty && isNowFilled;

    console.log('[useTypewriter] Effect triggered:', {
      targetText,
      prevTarget,
      enabled,
      wasEmpty,
      isNowFilled,
      shouldAnimate,
    });

    if (!shouldAnimate) {
      // Snap to new value immediately
      store.displayedText = targetText;
      store.index = targetText.length;
      notifyListeners();
      console.log('[useTypewriter] Snapping to:', targetText);
      return;
    }

    // Start animation from beginning
    store.index = 0;
    store.displayedText = "";
    notifyListeners();
    console.log('[useTypewriter] Starting animation for:', targetText);

    store.intervalId = setInterval(() => {
      store.index++;
      if (store.index >= targetText.length) {
        store.displayedText = targetText;
        if (store.intervalId) {
          clearInterval(store.intervalId);
          store.intervalId = null;
        }
      } else {
        store.displayedText = targetText.slice(0, store.index);
      }
      notifyListeners();
    }, speed);

    return () => {
      if (store.intervalId) {
        clearInterval(store.intervalId);
        store.intervalId = null;
      }
    };
  }, [targetText, speed, enabled, notifyListeners]);

  // Use useSyncExternalStore to subscribe to our custom store
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
