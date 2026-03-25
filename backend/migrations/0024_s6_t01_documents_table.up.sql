-- S6-T01: Documents table for markdown knowledge base
-- S6-T02: 19MB cap enforced at API layer (not DB)
-- S6-T04: Content-hash dedupe via unique index

CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title            TEXT NOT NULL CHECK (btrim(title) <> ''),
  content          TEXT NOT NULL,
  content_hash     TEXT NOT NULL,
  visibility_scope document_scope NOT NULL DEFAULT 'project',
  size_bytes       INTEGER NOT NULL DEFAULT 0,
  uploaded_by      UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dedupe: same content in same project
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_project_content_hash
  ON documents(project_id, content_hash);

-- No duplicate titles per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_project_title
  ON documents(project_id, title);

-- FK lookup
CREATE INDEX IF NOT EXISTS idx_documents_project_id
  ON documents(project_id);

-- Trigram index for mention search by title
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm
  ON documents USING gin(title extensions.gin_trgm_ops);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
