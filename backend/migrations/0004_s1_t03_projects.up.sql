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
