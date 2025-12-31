/**
 * API client for OxyChat backend.
 */

import type { Transcript, TranscriptDetail, StreamChunk } from "@/types/chat";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/**
 * Fetch all transcripts.
 */
export async function fetchTranscripts(limit = 20): Promise<Transcript[]> {
  const res = await fetch(`${API_BASE}/api/transcripts?limit=${limit}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch transcripts: ${res.statusText}`);
  }
  const data = await res.json();
  return data.transcripts;
}

/**
 * Fetch a single transcript by ID.
 */
export async function fetchTranscript(id: string): Promise<TranscriptDetail> {
  const res = await fetch(`${API_BASE}/api/transcripts/${id}`);
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Transcript not found");
    }
    throw new Error(`Failed to fetch transcript: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Upload a new transcript.
 */
export async function uploadTranscript(
  title: string,
  date: string,
  content: string
): Promise<Transcript> {
  const res = await fetch(`${API_BASE}/api/transcripts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, date, content }),
  });
  if (!res.ok) {
    throw new Error(`Failed to upload transcript: ${res.statusText}`);
  }
  return res.json();
}

/**
 * Delete a transcript by ID.
 */
export async function deleteTranscript(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/transcripts/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(`Failed to delete transcript: ${res.statusText}`);
  }
}

/**
 * Stream chat messages from the API.
 *
 * Yields StreamChunk objects as they arrive from the SSE stream.
 */
export async function* streamChat(
  messages: Array<{ role: string; content: string }>,
  mentions: string[],
  useRag = true
): AsyncGenerator<StreamChunk> {
  const res = await fetch(`${API_BASE}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, mentions, use_rag: useRag }),
  });

  if (!res.ok) {
    yield { type: "error", error: `Request failed: ${res.statusText}` };
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    yield { type: "error", error: "No response body" };
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events (separated by double newlines)
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        if (!event.trim()) continue;

        // Each event starts with "data: "
        for (const line of event.split("\n")) {
          if (line.startsWith("data: ")) {
            try {
              const chunk = JSON.parse(line.slice(6)) as StreamChunk;
              yield chunk;
            } catch {
              // Skip malformed JSON
              console.warn("Failed to parse SSE chunk:", line);
            }
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const chunk = JSON.parse(line.slice(6)) as StreamChunk;
            yield chunk;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
