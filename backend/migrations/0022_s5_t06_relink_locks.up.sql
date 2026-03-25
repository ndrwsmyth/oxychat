CREATE TABLE IF NOT EXISTS transcript_relink_locks (
  transcript_id UUID PRIMARY KEY REFERENCES transcripts(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcript_relink_locks_expires_at
  ON transcript_relink_locks(expires_at);
