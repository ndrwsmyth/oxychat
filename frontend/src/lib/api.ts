import type { Conversation, GroupedConversations, Message } from "@/types";
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
  onComplete: () => void;
  onError: (error: Error) => void;
}

export async function fetchTranscripts(): Promise<TranscriptResponse[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/transcripts`, { headers });
  if (!response.ok) {
    throw new Error("Failed to fetch transcripts");
  }
  const data = await response.json();
  return data.transcripts || [];
}

export async function searchTranscripts(query: string): Promise<TranscriptResponse[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/transcripts/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error("Failed to search transcripts");
  }
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
  onComplete,
  onError,
}: ChatStreamOptions): Promise<void> {
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
        use_rag: false,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
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
          if (data === "[DONE]") {
            onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            switch (parsed.type) {
              case "content":
                if (parsed.content) {
                  onChunk(parsed.content);
                }
                break;
              case "thinking_start":
                onThinkingStart?.();
                break;
              case "thinking":
                if (parsed.content) {
                  onThinkingChunk?.(parsed.content);
                }
                break;
              case "thinking_end":
                onThinkingEnd?.();
                break;
              case "done":
                onComplete();
                return;
              case "error":
                throw new Error(parsed.error || parsed.content || "Unknown error");
            }
          } catch (e) {
            if (e instanceof SyntaxError) {
              // Not JSON, treat as plain text
              onChunk(data);
            } else {
              throw e;
            }
          }
        }
      }
    }

    onComplete();
  } catch (error) {
    // Don't treat abort as an error
    if (error instanceof Error && error.name === "AbortError") {
      onComplete();
      return;
    }
    onError(error instanceof Error ? error : new Error("Unknown error"));
  }
}

// Parse @mentions from message
export function parseMentions(message: string): string[] {
  const mentionRegex = /@([^@\s]+(?:\s+[^@\s]+)*?)(?=\s+@|\s*$)/g;
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

  const headers = await getAuthHeaders();
  const response = await fetch(url.toString(), { headers });
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
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    throw new Error("Failed to update conversation");
  }

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function deleteConversation(id: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to delete conversation");
  }
}

export async function togglePinConversation(id: string): Promise<Conversation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${id}/pin`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to toggle pin");
  }

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch messages");
  }

  const data = await response.json();
  return data.map((msg: any) => ({
    ...msg,
    timestamp: new Date(msg.created_at),
  }));
}

export async function autoTitleConversation(conversationId: string): Promise<Conversation> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/auto-title`, {
    method: "POST",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to auto-title conversation");
  }

  const data = await response.json();
  return {
    ...data,
    pinned_at: data.pinned_at ? new Date(data.pinned_at) : null,
    created_at: new Date(data.created_at),
    updated_at: new Date(data.updated_at),
  };
}

export async function fetchDraft(conversationId: string): Promise<string> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/draft`, {
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to fetch draft");
  }

  const data = await response.json();
  return data.content || "";
}

export async function saveDraft(conversationId: string, content: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/draft`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error("Failed to save draft");
  }
}

export async function deleteDraft(conversationId: string): Promise<void> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/draft`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    throw new Error("Failed to delete draft");
  }
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

export async function searchConversations(query: string, limit: number = 20): Promise<SearchResult> {
  const headers = await getAuthHeaders();
  const url = new URL(`${API_BASE_URL}/api/search`);
  url.searchParams.set("q", query);
  url.searchParams.set("limit", limit.toString());

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    throw new Error("Failed to search conversations");
  }

  return response.json();
}
