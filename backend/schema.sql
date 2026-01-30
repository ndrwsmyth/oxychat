-- OxyChat Supabase Schema
-- Run this in the Supabase SQL Editor after nuking existing tables.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

-- ============================================================
-- Tables
-- ============================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Conversations
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title      TEXT,
  auto_titled BOOLEAN NOT NULL DEFAULT false,
  model      TEXT NOT NULL DEFAULT 'gpt-5.2',
  pinned     BOOLEAN NOT NULL DEFAULT false,
  pinned_at  TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_conversations_user ON conversations(user_id, deleted_at, updated_at DESC);
CREATE INDEX idx_conversations_pinned ON conversations(user_id, pinned, pinned_at DESC) WHERE pinned = true;

-- Messages
CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content         TEXT NOT NULL,
  model           TEXT,
  mentions        JSONB DEFAULT '[]'::jsonb,
  citations       JSONB DEFAULT '[]'::jsonb,
  token_count     INTEGER,
  request_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at ASC);
CREATE INDEX idx_messages_request ON messages(request_id) WHERE request_id IS NOT NULL;

-- Message feedback (thumbs up/down)
CREATE TABLE message_feedback (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  feedback    TEXT NOT NULL CHECK (feedback IN ('positive', 'negative')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_feedback_message ON message_feedback(message_id);

-- Transcripts
CREATE TABLE transcripts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id    TEXT UNIQUE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  summary      TEXT,
  date         TIMESTAMPTZ,
  raw_json     JSONB,
  title_search TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(title, ''))) STORED,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcripts_title_search ON transcripts USING GIN(title_search);
CREATE INDEX idx_transcripts_source ON transcripts(source_id) WHERE source_id IS NOT NULL;

-- Transcript chunks (for future RAG)
CREATE TABLE transcript_chunks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  chunk_index   INTEGER NOT NULL,
  embedding     extensions.vector(1536),
  content_search TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chunks_transcript ON transcript_chunks(transcript_id, chunk_index);
CREATE INDEX idx_chunks_embedding ON transcript_chunks USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_chunks_content_search ON transcript_chunks USING GIN(content_search);

-- Completion logs (Sediment CompletionRecord storage)
CREATE TABLE completion_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_id   TEXT,
  context_id      TEXT,
  request_id      TEXT,
  user_id         UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  product_name    TEXT,
  product_step    TEXT,
  model           TEXT,
  params          JSONB,
  completion      JSONB,
  timing          JSONB,
  tokens          JSONB,
  cost            JSONB,
  error           JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_completion_logs_request ON completion_logs(request_id);
CREATE INDEX idx_completion_logs_conversation ON completion_logs(conversation_id);
CREATE INDEX idx_completion_logs_created ON completion_logs(created_at DESC);

-- Effects (Sediment effect store)
CREATE TABLE effects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      TEXT,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  type            TEXT NOT NULL,
  payload         JSONB NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_effects_request ON effects(request_id);

-- Attachments (schema only, not wired up in Phase 1)
CREATE TABLE attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id      UUID REFERENCES messages(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,
  content_type    TEXT NOT NULL,
  size_bytes      INTEGER NOT NULL,
  storage_path    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE completion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE effects ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

-- User profiles: users can read/write their own
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Conversations: users can CRUD their own
CREATE POLICY "Users can view own conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- Messages: users can access messages in their conversations
CREATE POLICY "Users can view own messages" ON messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()));
CREATE POLICY "Users can create messages" ON messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()));

-- Transcripts: all authenticated users can read
CREATE POLICY "Authenticated users can view transcripts" ON transcripts FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can view chunks" ON transcript_chunks FOR SELECT USING (auth.role() = 'authenticated');

-- Completion logs: service role only (no RLS policy for users — backend uses service key)
-- Effects: service role only

-- ============================================================
-- Hybrid search function (for future RAG use)
-- ============================================================

CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding extensions.vector(1536),
  query_text TEXT,
  match_count INT DEFAULT 10,
  vector_weight FLOAT DEFAULT 0.7,
  text_weight FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id UUID,
  transcript_id UUID,
  content TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tc.id AS chunk_id,
    tc.transcript_id,
    tc.content,
    (
      vector_weight * (1 - (tc.embedding <=> query_embedding)) +
      text_weight * ts_rank(tc.content_search, plainto_tsquery('english', query_text))
    )::FLOAT AS similarity
  FROM transcript_chunks tc
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;
