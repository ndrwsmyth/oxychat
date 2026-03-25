# Sprint 5 Admin Audit Redaction Contract

## Scope
- Applies to `GET /api/admin/audit`.
- Redaction happens at response time only.
- Stored rows in `audit_events` remain append-only and unmodified.

## Cursor Contract
- `next_cursor` is an opaque base64-encoded JSON payload with:
  - `created_at` (ISO datetime string)
  - `id` (UUID)
- Pagination ordering is strict: `ORDER BY created_at DESC, id DESC`.
- Subsequent page filter is tuple-based: `(created_at, id) < (cursor_created_at, cursor_id)`.

## Redaction Rules
- If an audit row references `entity_type = "transcript"` and the referenced transcript is `private`:
  - Viewer is transcript attendee:
    - Return full row unchanged.
  - Viewer is not transcript attendee:
    - Return redacted row:
      - `entity_id = null`
      - `payload = { "redacted": true }`
      - `redacted = true`
      - `redaction_reason = "private_transcript_not_attendee"`

## Non-private Events
- Non-private transcript events and non-transcript events are returned unchanged with:
  - `redacted = false`
  - `redaction_reason = null`

## Benchmark Event Filter
- By default, events prefixed with `bench.` are excluded.
- `include_bench=1` or `include_bench=true` includes benchmark-prefixed events.
