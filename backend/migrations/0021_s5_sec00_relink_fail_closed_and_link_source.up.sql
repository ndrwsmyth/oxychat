BEGIN;

DO $$
DECLARE
  link_source_constraint_name TEXT;
BEGIN
  SELECT c.conname
  INTO link_source_constraint_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'transcript_project_links'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%link_source%';

  IF link_source_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.transcript_project_links DROP CONSTRAINT %I',
      link_source_constraint_name
    );
  END IF;
END
$$;

ALTER TABLE public.transcript_project_links
  ADD CONSTRAINT transcript_project_links_link_source_check
  CHECK (
    link_source IN (
      'domain_match',
      'title_alias',
      'client_inbox_fallback',
      'global_triage_fallback',
      'admin_manual'
    )
  );

CREATE OR REPLACE FUNCTION prevent_private_transcript_relink()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  transcript_visibility TEXT;
BEGIN
  SELECT visibility
  INTO transcript_visibility
  FROM transcript_classification
  WHERE transcript_id = NEW.transcript_id;

  IF transcript_visibility IS NULL OR transcript_visibility = 'private' THEN
    RAISE EXCEPTION 'Cannot relink private or unclassified transcript'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_private_transcript_relink ON transcript_project_links;
CREATE TRIGGER trg_prevent_private_transcript_relink
BEFORE INSERT OR UPDATE OF project_id ON transcript_project_links
FOR EACH ROW
EXECUTE FUNCTION prevent_private_transcript_relink();

COMMIT;
