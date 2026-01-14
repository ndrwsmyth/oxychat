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
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

// Conversation types
export interface Conversation {
  id: string;
  title: string;
  auto_titled: boolean;
  model: string;
  pinned: boolean;
  pinned_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface GroupedConversations {
  pinned: Conversation[];
  today: Conversation[];
  yesterday: Conversation[];
  last_7_days: Conversation[];
  last_30_days: Conversation[];
  older: Conversation[];
}

export type ModelOption =
  | "claude-sonnet-4.5"
  | "claude-opus-4.5"
  | "gpt-5.2"
  | "grok-4";
