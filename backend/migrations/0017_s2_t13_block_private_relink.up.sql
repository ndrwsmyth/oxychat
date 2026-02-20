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

  IF transcript_visibility = 'private' THEN
    RAISE EXCEPTION 'Cannot relink private transcript'
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
