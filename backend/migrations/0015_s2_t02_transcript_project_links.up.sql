CREATE TABLE IF NOT EXISTS transcript_project_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  link_source TEXT NOT NULL CHECK (
    link_source IN (
      'domain_match',
      'title_alias',
      'client_inbox_fallback',
      'global_triage_fallback'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(transcript_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_transcript_project_links_transcript
  ON transcript_project_links(transcript_id);

CREATE INDEX IF NOT EXISTS idx_transcript_project_links_project
  ON transcript_project_links(project_id);
