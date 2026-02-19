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
