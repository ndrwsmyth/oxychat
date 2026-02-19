ALTER TABLE conversations
  ALTER COLUMN project_id DROP NOT NULL;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_project_id_fkey;
