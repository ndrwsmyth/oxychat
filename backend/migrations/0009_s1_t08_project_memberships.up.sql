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
