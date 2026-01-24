import type { Conversation, GroupedConversations, Message, TruncationInfo, SourceInfo } from "@/types";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Fetch with automatic retry and toast notifications
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 3,
  showToast = true
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Don't retry on 4xx errors (client errors)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Request failed: ${response.status}`);
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Network error");

      // Show retrying toast (except on last attempt)
      if (showToast && attempt < retries - 1) {
        toast.loading(`Retrying... (${attempt + 2}/${retries})`, { id: "retry-toast" });
      }

      // Exponential backoff
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }

  // Dismiss retry toast and show error
  toast.dismiss("retry-toast");
  if (showToast) {
    toast.error(lastError?.message || "Request failed", {
      action: {
        label: "Retry",
        onClick: () => fetchWithRetry(url, options, retries, showToast),
      },
    });
  }

  throw lastError;
}

/**
 * Get authentication headers with Supabase JWT token
 * Returns basic headers if Supabase is not configured
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (supabase) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  }

  return headers;
}

/**
 * Centralized fetch wrapper with auth headers
 * Eliminates sequential auth header waterfall across API calls
 */
async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = await getAuthHeaders();
  return fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
}

export interface TranscriptResponse {
  id: string;
  title: string;
  date: string;
  summary?: string;
}

export interface ChatStreamOptions {
  conversationId?: string;
  messages: Array<{ role: string; content: string }>;
  mentions?: string[];
  model?: string;
  signal?: AbortSignal;
  onChunk: (chunk: string) => void;
  onThinkingStart?: () => void;
  onThinkingChunk?: (chunk: string) => void;
  onThinkingEnd?: () => void;
  onSources?: (sources: SourceInfo[], truncationInfo?: TruncationInfo[]) => void;
  onTitleUpdate?: (title: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export async function fetchTranscripts(): Promise<TranscriptResponse[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/transcripts`);
  if (!response.ok) throw new Error("Failed to fetch transcripts");

  const data = await response.json();
  return data.transcripts || [];
}

// NOTE: Embeddings/RAG is a future feature - this endpoint is currently disabled on the backend
export async function searchTranscripts(query: string): Promise<TranscriptResponse[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/transcripts/search`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error("Failed to search transcripts");

  return response.json();
}

export async function streamChat({
  conversationId,
  messages,
  mentions = [],
  model = "gpt-5.2",
  signal,
  onChunk,
  onThinkingStart,
  onThinkingChunk,
  onThinkingEnd,
  onSources,
  onTitleUpdate,
  onComplete,
  onError,
}: ChatStreamOptions): Promise<void> {
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          conversation_id: conversationId,
          messages,
          mentions,
          model,
          // NOTE: Embeddings/RAG is a future feature - disabled for now
          use_rag: false,
        }),
      });

      if (!response.ok) {
        // Don't retry on 4xx client errors
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`Request failed: ${response.status}`);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            // Legacy [DONE] format (kept for backward compatibility)
            if (data === "[DONE]") {
              onComplete();
              return;
            }
            try {
              const parsed = JSON.parse(data);
              switch (parsed.type) {
                case "sources":
                  if (parsed.sources) onSources?.(parsed.sources, parsed.truncation_info);
                  break;
                case "content":
                  if (parsed.content) onChunk(parsed.content);
                  break;
                case "thinking_start":
                  onThinkingStart?.();
                  break;
                case "thinking":
                  if (parsed.content) onThinkingChunk?.(parsed.content);
                  break;
                case "thinking_end":
                  onThinkingEnd?.();
                  break;
                case "title_update":
                  if (parsed.title) onTitleUpdate?.(parsed.title);
                  break;
                case "done":
                  onComplete();
                  return;
                case "error":
                  throw new Error(parsed.error || parsed.content || "Unknown error");
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Log malformed SSE data instead of passing to UI
                console.error("[streamChat] Malformed SSE data:", data.substring(0, 100));
              } else {
                throw e;
              }
            }
          }
        }
      }

      onComplete();
      return; // Success - exit retry loop

    } catch (error) {
      // Don't retry on abort
      if (error instanceof Error && error.name === "AbortError") {
        onComplete();
        return;
      }

      // Don't retry on 4xx errors (already thrown above with specific message)
      if (error instanceof Error && error.message.startsWith("Request failed:")) {
        onError(error);
        return;
      }

      lastError = error instanceof Error ? error : new Error("Unknown error");

      // Show retry toast (except on last attempt)
      if (attempt < MAX_RETRIES) {
        const backoffMs = 1000 * Math.pow(2, attempt); // 1s, 2s
        toast.loading(`Connection lost. Retrying... (${attempt + 2}/${MAX_RETRIES + 1})`, {
          id: "sse-retry-toast",
          duration: backoffMs,
        });
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  // All retries exhausted
  toast.dismiss("sse-retry-toast");
  onError(lastError || new Error("Stream failed after retries"));
}

// Parse @mentions from message
// Supports @[Title with spaces] format (from OxyComposer mention pills)
export function parseMentions(message: string): string[] {
  // Match @[Title with spaces] format
  const mentionRegex = /@\[([^\]]+)\]/g;
  const mentions: string[] = [];
  let match;

  while ((match = mentionRegex.exec(message)) !== null) {
    mentions.push(match[1].trim());
  }

  return mentions;
}

// Conversation API functions
export async function fetchConversations(search?: string): Promise<GroupedConversations> {
  const url = new URL(`${API_BASE_URL}/api/conversations`);
  if (search) {
    url.searchParams.set("search", search);
  }

  const response = await fetchWithAuth(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch conversations");
  }

  const data = await response.json();

  // Convert date strings to Date objects
  const convertDates = (conv: any): Conversation => ({
    ...conv,
    pinned_at: conv.pinned_at ? new Date(conv.pinned_at) : null,
    created_at: new Date(conv.created_at),
    updated_at: new Date(conv.updated_at),
  });

  return {
    pinned: data.pinned.map(convertDates),
    today: data.today.map(convertDates),
    yesterday: data.yesterday.map(convertDates),
    last_7_days: data.last_7_days.map(convertDates),
    last_30_days: data.last_30_days.map(convertDates),
    older: data.older.map(convertDates),
  };
}

export async function createConversation(title?: string): Promise<Conversation> {
  const headers = await getAuthHeaders();
  const response = await fetchWithRetry(
    `${API_BASE_URL}/api/conversations`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ title }),
    }
  );

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function updateConversation(
  id: string,
  updates: Partial<Conversation>
): Promise<Conversation> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/conversations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
  if (!response.ok) throw new Error("Failed to update conversation");

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function deleteConversation(id: string): Promise<void> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/conversations/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Failed to delete conversation");
}

export async function togglePinConversation(id: string): Promise<Conversation> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/conversations/${id}/pin`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Failed to toggle pin");

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/conversations/${conversationId}/messages`
  );
  if (!response.ok) throw new Error("Failed to fetch messages");

  const data = await response.json();
  return data.map((msg: any) => ({
    ...msg,
    timestamp: new Date(msg.created_at),
  }));
}

export async function autoTitleConversation(conversationId: string): Promise<Conversation> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/conversations/${conversationId}/auto-title`,
    { method: "POST" }
  );
  if (!response.ok) throw new Error("Failed to auto-title conversation");

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function fetchDraft(conversationId: string): Promise<string> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/conversations/${conversationId}/draft`
  );
  if (!response.ok) throw new Error("Failed to fetch draft");

  const data = await response.json();
  return data.content || "";
}

export async function saveDraft(conversationId: string, content: string): Promise<void> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/conversations/${conversationId}/draft`,
    {
      method: "PUT",
      body: JSON.stringify({ content }),
    }
  );
  if (!response.ok) throw new Error("Failed to save draft");
}

export async function deleteDraft(conversationId: string): Promise<void> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/conversations/${conversationId}/draft`,
    { method: "DELETE" }
  );
  if (!response.ok) throw new Error("Failed to delete draft");
}

// Search API
export interface SearchResult {
  conversations: Array<{
    id: string
    title: string
    model: string
    pinned: boolean
    created_at: string
    updated_at: string
    rank: number
    message_count: number
  }>
  messages: Array<{
    id: string
    conversation_id: string
    conversation_title: string
    role: string
    content: string
    created_at: string
    rank: number
  }>
  total_results: number
}

export async function searchConversations(query: string, limit = 20): Promise<SearchResult> {
  const url = new URL(`${API_BASE_URL}/api/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", limit.toString());

  const response = await fetchWithAuth(url.toString());
  if (!response.ok) throw new Error("Failed to search conversations");

  return response.json();
}
