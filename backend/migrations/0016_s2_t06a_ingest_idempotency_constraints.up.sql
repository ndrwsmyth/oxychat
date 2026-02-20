CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_project_links_transcript_unique
  ON transcript_project_links(transcript_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_classification_transcript_unique
  ON transcript_classification(transcript_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_attendees_unique
  ON transcript_attendees(transcript_id, normalized_email);
