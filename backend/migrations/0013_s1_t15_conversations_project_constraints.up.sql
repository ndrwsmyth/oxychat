DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM conversations
    WHERE project_id IS NULL
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'Cannot enforce project_id constraints while NULL values exist';
  END IF;
END
$$;

ALTER TABLE conversations
  DROP CONSTRAINT IF EXISTS conversations_project_id_fkey;

ALTER TABLE conversations
  ADD CONSTRAINT conversations_project_id_fkey
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE conversations
  VALIDATE CONSTRAINT conversations_project_id_fkey;

ALTER TABLE conversations
  ALTER COLUMN project_id SET NOT NULL;
