CREATE TABLE IF NOT EXISTS transcript_classification (
  transcript_id UUID PRIMARY KEY REFERENCES transcripts(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'non_private')),
  classification_reason TEXT NOT NULL CHECK (
    classification_reason IN (
      'weekly_exception',
      'external_attendee',
      'internal_attendees_only',
      'no_attendees'
    )
  ),
  is_weekly_exception BOOLEAN NOT NULL DEFAULT false,
  normalized_title TEXT NOT NULL,
  attendee_count INTEGER NOT NULL DEFAULT 0,
  external_attendee_count INTEGER NOT NULL DEFAULT 0,
  classified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transcript_classification_visibility
  ON transcript_classification(visibility);

CREATE INDEX IF NOT EXISTS idx_transcript_classification_normalized_title
  ON transcript_classification(normalized_title);
