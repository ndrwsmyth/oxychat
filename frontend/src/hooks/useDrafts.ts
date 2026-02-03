import type { ModelOption } from "@/types";

export interface MentionChip {
  id: string;
  title: string;
}

export interface DraftData {
  text: string;
  mentions: MentionChip[];
  model: ModelOption;
  updatedAt: number;
}

const DRAFT_PREFIX = "oxy-draft-";
const TTL_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

function getDraftKey(conversationId: string | null): string {
  return `${DRAFT_PREFIX}${conversationId ?? "new"}`;
}

function hasLocalStorage(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  } catch {
    return false;
  }
}

export function getDraft(conversationId: string | null): DraftData | null {
  if (!hasLocalStorage()) return null;

  try {
    const key = getDraftKey(conversationId);
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const draft = JSON.parse(stored) as DraftData;

    if (Date.now() - draft.updatedAt > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(conversationId: string | null, draft: Omit<DraftData, "updatedAt">): void {
  if (!hasLocalStorage()) return;

  try {
    const key = getDraftKey(conversationId);
    const draftWithTimestamp: DraftData = { ...draft, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(draftWithTimestamp));
  } catch {
    // localStorage might be full or disabled
  }
}

export function clearDraft(conversationId: string | null): void {
  if (!hasLocalStorage()) return;

  try {
    localStorage.removeItem(getDraftKey(conversationId));
  } catch {
    // Silently fail
  }
}

export function cleanupDrafts(validConversationIds?: Set<string>): void {
  if (!hasLocalStorage()) return;

  try {
    const keysToRemove: string[] = [];
    const now = Date.now();

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(DRAFT_PREFIX)) continue;

      const stored = localStorage.getItem(key);
      if (!stored) continue;

      try {
        const draft = JSON.parse(stored) as DraftData;

        if (now - draft.updatedAt > TTL_MS) {
          keysToRemove.push(key);
          continue;
        }

        if (validConversationIds) {
          const conversationId = key.slice(DRAFT_PREFIX.length);
          if (conversationId !== "new" && !validConversationIds.has(conversationId)) {
            keysToRemove.push(key);
          }
        }
      } catch {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Silently fail
  }
}
