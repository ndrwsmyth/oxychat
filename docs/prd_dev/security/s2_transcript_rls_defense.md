# S2 Transcript RLS Defense-in-Depth

Sprint 2 replaces permissive transcript read policies with `user_can_view_transcript(uuid)` checks.

## Policy Summary

- Unclassified transcripts: hidden (fail-closed).
- Private transcripts: visible only when the caller's normalized email appears in `transcript_attendees`.
- Non-private transcripts: visible only when linked via `transcript_project_links` to a project the caller can access.
- Admin role (`user_roles.role = 'admin'`) can view non-private transcripts, but not private transcripts unless attendee.

## Objects

- Function: `user_can_view_transcript(uuid)`
- Policies:
  - `Users can view visible transcripts` on `transcripts`
  - `Users can view visible transcript chunks` on `transcript_chunks`

## Migration

- Applied in `0018_s2_t15_transcript_rls_defense.up.sql`.
- Rollback restores legacy authenticated-read policies in `0018_s2_t15_transcript_rls_defense.down.sql`.
