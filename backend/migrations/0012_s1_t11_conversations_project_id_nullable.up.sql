ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS project_id UUID;

CREATE INDEX IF NOT EXISTS idx_conversations_project
  ON conversations(project_id)
  WHERE deleted_at IS NULL;
