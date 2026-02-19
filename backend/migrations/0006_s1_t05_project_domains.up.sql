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
