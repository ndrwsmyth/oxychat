DROP POLICY IF EXISTS "Authenticated users can view transcripts" ON transcripts;
DROP POLICY IF EXISTS "Authenticated users can view chunks" ON transcript_chunks;
DROP POLICY IF EXISTS "Users can view visible transcripts" ON transcripts;
DROP POLICY IF EXISTS "Users can view visible transcript chunks" ON transcript_chunks;

CREATE OR REPLACE FUNCTION user_can_view_transcript(target_transcript_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_id UUID;
  viewer_email TEXT;
  classification_visibility TEXT;
BEGIN
  viewer_id := auth.uid();
  IF viewer_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT tc.visibility
  INTO classification_visibility
  FROM transcript_classification tc
  WHERE tc.transcript_id = target_transcript_id;

  IF classification_visibility IS NULL THEN
    RETURN FALSE;
  END IF;

  IF classification_visibility = 'private' THEN
    SELECT lower(btrim(up.email))
    INTO viewer_email
    FROM user_profiles up
    WHERE up.id = viewer_id;

    IF viewer_email IS NULL THEN
      RETURN FALSE;
    END IF;

    RETURN EXISTS (
      SELECT 1
      FROM transcript_attendees ta
      WHERE ta.transcript_id = target_transcript_id
        AND ta.normalized_email = viewer_email
    );
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM transcript_project_links tpl
    INNER JOIN projects p ON p.id = tpl.project_id
    WHERE tpl.transcript_id = target_transcript_id
      AND (
        EXISTS (
          SELECT 1
          FROM user_roles ur
          WHERE ur.user_id = viewer_id
            AND ur.role = 'admin'
        )
        OR p.owner_user_id = viewer_id
        OR EXISTS (
          SELECT 1
          FROM project_memberships pm
          WHERE pm.project_id = p.id
            AND pm.user_id = viewer_id
        )
        OR EXISTS (
          SELECT 1
          FROM client_memberships cm
          WHERE cm.client_id = p.client_id
            AND cm.user_id = viewer_id
        )
      )
  );
END;
$$;

CREATE POLICY "Users can view visible transcripts" ON transcripts
FOR SELECT
USING (user_can_view_transcript(id));

CREATE POLICY "Users can view visible transcript chunks" ON transcript_chunks
FOR SELECT
USING (user_can_view_transcript(transcript_id));
