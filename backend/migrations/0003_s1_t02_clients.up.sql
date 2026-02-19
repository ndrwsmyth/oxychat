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
