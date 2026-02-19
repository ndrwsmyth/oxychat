CREATE TABLE IF NOT EXISTS transcript_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  normalized_email TEXT GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT transcript_attendees_email_not_empty CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_transcript_attendees_unique
  ON transcript_attendees(transcript_id, normalized_email);

CREATE INDEX IF NOT EXISTS idx_transcript_attendees_email
  ON transcript_attendees(normalized_email);
