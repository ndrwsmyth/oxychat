const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface TranscriptResponse {
  id: string;
  title: string;
  date: string;
  summary?: string;
}

export interface ChatStreamOptions {
  messages: Array<{ role: string; content: string }>;
  mentions?: string[];
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export async function fetchTranscripts(): Promise<TranscriptResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/transcripts`);
  if (!response.ok) {
    throw new Error("Failed to fetch transcripts");
  }
  const data = await response.json();
  return data.transcripts || [];
}

export async function searchTranscripts(query: string): Promise<TranscriptResponse[]> {
  const response = await fetch(`${API_BASE_URL}/api/transcripts/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error("Failed to search transcripts");
  }
  return response.json();
}

export async function streamChat({
  messages,
  mentions = [],
  onChunk,
  onComplete,
  onError,
}: ChatStreamOptions): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        mentions,
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
            if (parsed.type === "content" && parsed.content) {
              onChunk(parsed.content);
            } else if (parsed.type === "done") {
              onComplete();
              return;
            } else if (parsed.type === "error") {
              throw new Error(parsed.error || "Unknown error");
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
