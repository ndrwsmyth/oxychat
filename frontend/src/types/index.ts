export interface Message {
  id: string;
  conversation_id?: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  model?: string;
  mentions?: string[];
  timestamp: Date;
}

export interface Transcript {
  id: string;
  title: string;
  date: Date;
  summary?: string;
  scope_bucket?: "project" | "global";
  project_tag?: TranscriptTag | null;
  client_tag?: TranscriptTag | null;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface TranscriptTag {
  id: string;
  name: string;
  scope: "personal" | "client" | "global";
}

// Conversation types
export interface Conversation {
  id: string;
  title: string | null; // Null until auto-titled on first message
  auto_titled: boolean;
  model: string;
  project_id: string;
  pinned: boolean;
  pinned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GroupedConversations {
  pinned: Conversation[];
  today: Conversation[];
  yesterday: Conversation[];
  two_days_ago: Conversation[];
  last_7_days: Conversation[];
  last_week: Conversation[];
  older: Conversation[];
}

export type ModelOption = string;

export interface ModelMetadata {
  key: string;
  label: string;
  provider: string;
}

export interface ModelsResponse {
  defaultModel: string;
  models: ModelMetadata[];
}

export interface WorkspaceTreeProject {
  id: string;
  name: string;
  scope: "personal" | "client" | "global";
  client_id: string;
  conversation_count: number;
}

export interface WorkspaceTreeClient {
  id: string;
  name: string;
  scope: "personal" | "client" | "global";
  projects: WorkspaceTreeProject[];
}

// Truncation info for @mentioned documents
export interface TruncationInfo {
  doc_id: string;
  title: string;
  truncated: boolean;
  percent_included: number;
}

// Source info from chat API
export interface SourceInfo {
  doc_id: string;
  title: string;
  type: "mention" | "rag" | "overview";
}
