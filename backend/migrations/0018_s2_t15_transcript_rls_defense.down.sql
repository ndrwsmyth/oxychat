DROP POLICY IF EXISTS "Users can view visible transcripts" ON transcripts;
DROP POLICY IF EXISTS "Users can view visible transcript chunks" ON transcript_chunks;

DROP FUNCTION IF EXISTS user_can_view_transcript(UUID);

CREATE POLICY "Authenticated users can view transcripts" ON transcripts
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view chunks" ON transcript_chunks
FOR SELECT
USING (auth.role() = 'authenticated');
