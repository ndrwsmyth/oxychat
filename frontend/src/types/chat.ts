export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  mentions?: TranscriptMention[];
  createdAt: Date;
  isStreaming?: boolean;
}

export interface TranscriptMention {
  id: string; // doc_xxx format
  title: string;
  position: number; // cursor position in content where @mention was inserted
}

export interface Transcript {
  id: string; // doc_xxx format
  title: string;
  date: string;
  source: "circleback" | "manual";
  summary?: string;
}

export interface TranscriptDetail extends Transcript {
  content: string;
  attendees: Array<{ name: string; email?: string }>;
}

export interface ChatSession {
  id: string;
  messages: Message[];
  createdAt: Date;
}

export interface StreamChunk {
  type: "content" | "done" | "error" | "sources";
  content?: string;
  error?: string;
  sources?: Array<{
    doc_id: string;
    title: string;
    type: "mention" | "rag";
  }>;
}

export interface ChatRequest {
  messages: Array<{ role: string; content: string }>;
  mentions: string[];
  use_rag?: boolean;
}
