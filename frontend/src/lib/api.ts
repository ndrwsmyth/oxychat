import type {
  Conversation,
  GroupedConversations,
  Message,
  ModelOption,
  ModelsResponse,
  TruncationInfo,
  SourceInfo,
  TranscriptTag,
  WorkspaceTreeClient,
} from "@/types";
import { toast } from "sonner";

type RawConversation = Omit<Conversation, 'pinned_at' | 'created_at' | 'updated_at'> & {
  pinned_at: string | null;
  created_at: string;
  updated_at: string;
};

type RawMessage = Omit<Message, 'timestamp'> & { created_at: string };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Token getter that will be set by useAuthSetup
let getTokenFn: (() => Promise<string | null>) | null = null;
const AUTH_GETTER_WAIT_TIMEOUT_MS = 1500;
const AUTH_TOKEN_RETRY_DELAY_MS = 120;

/**
 * Set the auth token getter function.
 * Called by useAuthSetup hook to wire up Clerk's getToken.
 */
export function setAuthTokenGetter(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAuthTokenGetter(
  timeoutMs = AUTH_GETTER_WAIT_TIMEOUT_MS
): Promise<(() => Promise<string | null>) | null> {
  if (getTokenFn) return getTokenFn;

  const startedAt = Date.now();
  while (!getTokenFn && Date.now() - startedAt < timeoutMs) {
    await sleep(25);
  }

  return getTokenFn;
}

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
 * Get headers for API requests.
 * Includes Clerk auth token when available.
 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  const tokenGetter = await waitForAuthTokenGetter();
  if (tokenGetter) {
    let token = await tokenGetter();
    // Clerk can briefly return null during startup hydration.
    if (!token) {
      await sleep(AUTH_TOKEN_RETRY_DELAY_MS);
      token = await tokenGetter();
    }
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
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
  scope_bucket?: "project" | "global";
  project_tag?: TranscriptTag | null;
  client_tag?: TranscriptTag | null;
}

interface MentionQueryBucketsResponse {
  project: TranscriptResponse[];
  global: TranscriptResponse[];
  mode: string;
  took_ms: number;
}

export interface MentionQueryOptions {
  projectId?: string;
  conversationId?: string;
  limit?: number;
  signal?: AbortSignal;
}

export interface MentionQueryResult {
  transcripts: TranscriptResponse[];
  mode: string;
  tookMs: number;
}

export interface WorkspacesTreeResponse {
  clients: WorkspaceTreeClient[];
}

export interface ConversationWithMessagesResponse {
  messages: Message[];
  projectId: string | null;
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
  onTitleUpdate?: (title: string, conversationId: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

const FALLBACK_MODELS_RESPONSE: ModelsResponse = {
  defaultModel: "claude-sonnet-4-6",
  models: [
    { key: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
    { key: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
    { key: "gpt-5.2", label: "GPT-5.2", provider: "openai" },
    { key: "grok-4", label: "Grok 4", provider: "openai" },
  ],
};

export async function fetchTranscripts(projectId?: string): Promise<TranscriptResponse[]> {
  const url = new URL(`${API_BASE_URL}/api/transcripts`);
  if (projectId) {
    url.searchParams.set("project", projectId);
  }
  const response = await fetchWithAuth(url.toString());
  if (!response.ok) throw new Error("Failed to fetch transcripts");

  return response.json();
}

export async function searchTranscripts(query: string, projectId?: string): Promise<TranscriptResponse[]> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/transcripts/search`, {
    method: "POST",
    body: JSON.stringify({
      query,
      ...(projectId ? { project_id: projectId } : {}),
    }),
  });
  if (!response.ok) throw new Error("Failed to search transcripts");

  return response.json();
}

export async function queryMentionTranscripts(
  query: string,
  options: MentionQueryOptions = {}
): Promise<MentionQueryResult> {
  const body: Record<string, unknown> = { query };
  if (options.projectId) {
    body.project_id = options.projectId;
  }
  if (options.conversationId) {
    body.conversation_id = options.conversationId;
  }
  if (typeof options.limit === "number") {
    body.limit = options.limit;
  }

  const response = await fetchWithAuth(`${API_BASE_URL}/api/transcripts/mentions/query`, {
    method: "POST",
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error("Failed to query mention transcripts");
  }

  const data = await response.json() as MentionQueryBucketsResponse;
  const project = (data.project ?? []).map((item) => ({ ...item, scope_bucket: "project" as const }));
  const global = (data.global ?? []).map((item) => ({ ...item, scope_bucket: "global" as const }));

  return {
    transcripts: [...project, ...global],
    mode: data.mode,
    tookMs: data.took_ms,
  };
}

export async function fetchWorkspaces(): Promise<WorkspacesTreeResponse> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/workspaces/tree`);
  if (!response.ok) throw new Error("Failed to fetch workspaces");
  return response.json();
}

export async function streamChat({
  conversationId,
  messages,
  mentions = [],
  model,
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
      if (!conversationId) {
        throw new Error("conversationId is required - create a conversation first");
      }
      const headers = await getAuthHeaders();
      const endpoint = `${API_BASE_URL}/api/conversations/${conversationId}/messages`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        signal,
        body: JSON.stringify({
          content: messages[messages.length - 1]?.content,
          mentions,
          ...(model ? { model } : {}),
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
                case "token":
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
                  if (parsed.title && conversationId) {
                    onTitleUpdate?.(parsed.title, conversationId);
                  }
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
export async function fetchConversations(search?: string, projectId?: string): Promise<GroupedConversations> {
  const url = new URL(`${API_BASE_URL}/api/conversations`);
  if (search) {
    url.searchParams.set("search", search);
  }
  if (projectId) {
    url.searchParams.set("project", projectId);
  }

  const response = await fetchWithAuth(url.toString());
  if (!response.ok) {
    throw new Error("Failed to fetch conversations");
  }

  const data = await response.json();

  // Convert date strings to Date objects
  const convertDates = (conv: RawConversation): Conversation => ({
    ...conv,
    pinned_at: conv.pinned_at ? new Date(conv.pinned_at) : null,
    created_at: new Date(conv.created_at),
    updated_at: new Date(conv.updated_at),
  });

  return {
    pinned: data.pinned.map(convertDates),
    today: data.today.map(convertDates),
    yesterday: data.yesterday.map(convertDates),
    two_days_ago: data.two_days_ago.map(convertDates),
    last_7_days: data.last_7_days.map(convertDates),
    last_week: data.last_week.map(convertDates),
    older: data.older.map(convertDates),
  };
}

export async function fetchModels(): Promise<ModelsResponse> {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/models`);
    if (!response.ok) {
      console.warn(`[api] /api/models returned ${response.status}, using fallback model metadata`);
      return FALLBACK_MODELS_RESPONSE;
    }
    return response.json();
  } catch (error) {
    console.warn("[api] Failed to fetch /api/models, using fallback model metadata", error);
    return FALLBACK_MODELS_RESPONSE;
  }
}

export async function createConversation(
  title?: string,
  model?: ModelOption,
  projectId?: string
): Promise<Conversation> {
  const headers = await getAuthHeaders();
  const response = await fetchWithRetry(
    `${API_BASE_URL}/api/conversations`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        title,
        ...(model ? { model } : {}),
        ...(projectId ? { project_id: projectId } : {}),
      }),
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

export async function fetchConversationWithMessages(
  conversationId: string
): Promise<ConversationWithMessagesResponse> {
  const response = await fetchWithAuth(
    `${API_BASE_URL}/api/conversations/${conversationId}`
  );
  if (!response.ok) throw new Error("Failed to fetch conversation");

  const data = await response.json();
  return {
    projectId: typeof data.project_id === "string" ? data.project_id : null,
    messages: (data.messages || []).map((msg: RawMessage) => ({
      ...msg,
      timestamp: new Date(msg.created_at),
    })),
  };
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { messages } = await fetchConversationWithMessages(conversationId);
  return messages;
}

// Feedback API
export type FeedbackType = 'positive' | 'negative' | null;

export async function submitMessageFeedback(
  messageId: string,
  feedback: FeedbackType
): Promise<{ feedback: FeedbackType }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/messages/${messageId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ feedback }),
  });
  if (!response.ok) throw new Error("Failed to submit feedback");
  return response.json();
}

export async function getMessageFeedback(
  messageId: string
): Promise<{ feedback: FeedbackType }> {
  const response = await fetchWithAuth(`${API_BASE_URL}/api/messages/${messageId}/feedback`);
  if (!response.ok) throw new Error("Failed to get feedback");
  return response.json();
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
