-- OxyChat Supabase Schema
-- Run this in the Supabase SQL Editor after nuking existing tables.
-- NOTE: Versioned migrations in backend/migrations are the source of truth for
-- Sprint 1+ changes. This file is a baseline snapshot for bootstrapping only.

-- Extensions
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

-- ============================================================
-- Tables
-- ============================================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clerk_id   TEXT UNIQUE,
  email      TEXT NOT NULL UNIQUE,
  full_name  TEXT,
  avatar_url TEXT,
  context    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sprint 1 enums (kept here so baseline reset can bootstrap routing tables)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role') THEN
    CREATE TYPE role AS ENUM ('admin', 'member');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'workspace_scope') THEN
    CREATE TYPE workspace_scope AS ENUM ('personal', 'client', 'global');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_scope') THEN
    CREATE TYPE document_scope AS ENUM ('project', 'client', 'global');
  END IF;
END
$$;

-- Sprint 1 routing + membership tables
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  normalized_name TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  scope workspace_scope NOT NULL DEFAULT 'client',
  owner_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clients_name_not_empty CHECK (btrim(name) <> ''),
  CONSTRAINT clients_personal_owner_check CHECK (
    (scope = 'personal' AND owner_user_id IS NOT NULL)
    OR scope <> 'personal'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_scope_normalized_name_unique
  ON clients(scope, normalized_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_personal_owner_unique
  ON clients(owner_user_id, scope)
  WHERE scope = 'personal';

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  normalized_name TEXT GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  scope workspace_scope NOT NULL DEFAULT 'client',
  owner_user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  is_inbox BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_name_not_empty CHECK (btrim(name) <> ''),
  CONSTRAINT projects_personal_owner_check CHECK (
    (scope = 'personal' AND owner_user_id IS NOT NULL)
    OR scope <> 'personal'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_client_normalized_name_unique
  ON projects(client_id, normalized_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_personal_owner_unique
  ON projects(owner_user_id, scope)
  WHERE scope = 'personal';

CREATE INDEX IF NOT EXISTS idx_projects_client_id
  ON projects(client_id);

CREATE TABLE IF NOT EXISTS project_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT GENERATED ALWAYS AS (lower(btrim(alias))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_aliases_alias_not_empty CHECK (btrim(alias) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_aliases_normalized_unique
  ON project_aliases(normalized_alias);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_aliases_project_normalized_unique
  ON project_aliases(project_id, normalized_alias);

CREATE TABLE IF NOT EXISTS project_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  normalized_domain TEXT GENERATED ALWAYS AS (lower(btrim(domain))) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_domains_domain_not_empty CHECK (btrim(domain) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_domains_normalized_unique
  ON project_domains(normalized_domain);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_domains_project_normalized_unique
  ON project_domains(project_id, normalized_domain);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  role role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles(role);

CREATE TABLE IF NOT EXISTS client_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_client_memberships_client
  ON client_memberships(client_id);

CREATE INDEX IF NOT EXISTS idx_client_memberships_user
  ON client_memberships(user_id);

CREATE TABLE IF NOT EXISTS project_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_project_memberships_project
  ON project_memberships(project_id);

CREATE INDEX IF NOT EXISTS idx_project_memberships_user
  ON project_memberships(user_id);

-- Conversations
CREATE TABLE conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  title      TEXT,
  auto_titled BOOLEAN NOT NULL DEFAULT false,
  model      TEXT NOT NULL DEFAULT 'claude-sonnet-4-6',
  pinned     BOOLEAN NOT NULL DEFAULT false,
  pinned_at  TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration/backfill for existing databases:
-- See docs/MODEL_CONSISTENCY_CLAUDE_46_MIGRATION.sql for a copy/paste-ready script.
-- ALTER TABLE conversations ALTER COLUMN model SET DEFAULT 'claude-sonnet-4-6';
-- UPDATE conversations SET model = 'claude-sonnet-4-6' WHERE model = 'claude-sonnet-4.5';
-- UPDATE conversations SET model = 'claude-opus-4-6' WHERE model = 'claude-opus-4.5';
-- UPDATE conversations
-- SET model = 'claude-sonnet-4-6'
-- WHERE model IS NULL
--   OR model = ''
--   OR model NOT IN ('claude-sonnet-4-6', 'claude-opus-4-6', 'gpt-5.2', 'grok-4');

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

-- Transcript attendees
CREATE TABLE transcript_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  normalized_email TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transcript_attendees_email_not_empty CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX idx_transcript_attendees_unique
  ON transcript_attendees(transcript_id, normalized_email);

CREATE INDEX idx_transcript_attendees_email
  ON transcript_attendees(normalized_email);

-- Transcript classification
CREATE TABLE transcript_classification (
  transcript_id UUID PRIMARY KEY REFERENCES transcripts(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'non_private')),
  classification_reason TEXT NOT NULL CHECK (
    classification_reason IN (
      'weekly_exception',
      'external_attendee',
      'internal_attendees_only',
      'no_attendees'
    )
  ),
  is_weekly_exception BOOLEAN NOT NULL DEFAULT false,
  normalized_title TEXT NOT NULL,
  attendee_count INTEGER NOT NULL DEFAULT 0,
  external_attendee_count INTEGER NOT NULL DEFAULT 0,
  classified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transcript_classification_visibility
  ON transcript_classification(visibility);

CREATE INDEX idx_transcript_classification_normalized_title
  ON transcript_classification(normalized_title);

-- Transcript project links
CREATE TABLE transcript_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  link_source TEXT NOT NULL CHECK (
    link_source IN (
      'domain_match',
      'title_alias',
      'client_inbox_fallback',
      'global_triage_fallback'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transcript_id, project_id)
);

CREATE UNIQUE INDEX idx_transcript_project_links_transcript_unique
  ON transcript_project_links(transcript_id);

CREATE INDEX idx_transcript_project_links_project
  ON transcript_project_links(project_id);

CREATE OR REPLACE FUNCTION prevent_private_transcript_relink()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  transcript_visibility TEXT;
BEGIN
  SELECT visibility
  INTO transcript_visibility
  FROM transcript_classification
  WHERE transcript_id = NEW.transcript_id;

  IF transcript_visibility = 'private' THEN
    RAISE EXCEPTION 'Cannot relink private transcript'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_private_transcript_relink ON transcript_project_links;
CREATE TRIGGER trg_prevent_private_transcript_relink
BEFORE INSERT OR UPDATE OF project_id ON transcript_project_links
FOR EACH ROW
EXECUTE FUNCTION prevent_private_transcript_relink();

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

CREATE OR REPLACE FUNCTION user_can_view_transcript(target_transcript_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_email TEXT;
  classification_visibility TEXT;
BEGIN
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT tc.visibility
  INTO classification_visibility
  FROM transcript_classification tc
  WHERE tc.transcript_id = target_transcript_id;

  IF classification_visibility IS NULL THEN
    RETURN FALSE;
  END IF;

  IF classification_visibility = 'private' THEN
    SELECT lower(btrim(up.email))
    INTO viewer_email
    FROM user_profiles up
    WHERE up.id = viewer_id;

    IF viewer_email IS NULL THEN
      RETURN FALSE;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM transcript_attendees ta
      WHERE ta.transcript_id = target_transcript_id
        AND ta.normalized_email = viewer_email
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM transcript_project_links tpl
    INNER JOIN projects p ON p.id = tpl.project_id
    WHERE tpl.transcript_id = target_transcript_id
      AND (
        EXISTS (
          SELECT 1
          FROM user_roles ur
          WHERE ur.user_id = viewer_id
            AND ur.role = 'admin'
        )
        OR p.owner_user_id = viewer_id
        OR EXISTS (
          SELECT 1
          FROM project_memberships pm
          WHERE pm.project_id = p.id
            AND pm.user_id = viewer_id
        )
        OR EXISTS (
          SELECT 1
          FROM client_memberships cm
          WHERE cm.client_id = p.client_id
            AND cm.user_id = viewer_id
        )
      )
  );
END;
$$;

CREATE POLICY "Users can view visible transcripts" ON transcripts FOR SELECT
  USING (user_can_view_transcript(id));

CREATE POLICY "Users can view visible transcript chunks" ON transcript_chunks FOR SELECT
  USING (user_can_view_transcript(transcript_id));

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
