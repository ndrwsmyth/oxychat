DROP INDEX IF EXISTS idx_conversations_project;

ALTER TABLE conversations
  DROP COLUMN IF EXISTS project_id;
