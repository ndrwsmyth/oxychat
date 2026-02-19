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
