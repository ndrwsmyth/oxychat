DROP TRIGGER IF EXISTS trg_audit_events_append_only ON audit_events;
DROP FUNCTION IF EXISTS prevent_audit_events_mutation;
DROP TABLE IF EXISTS audit_events;
