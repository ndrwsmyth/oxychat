ALTER TABLE projects
ADD COLUMN IF NOT EXISTS overview_markdown TEXT;
