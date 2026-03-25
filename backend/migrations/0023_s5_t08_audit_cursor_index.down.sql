DROP INDEX IF EXISTS idx_audit_events_cursor;

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at
  ON audit_events(created_at DESC);
