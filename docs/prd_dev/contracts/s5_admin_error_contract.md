# Sprint 5 Admin Error Contract

## Scope
- Applies to admin middleware and admin routes under `/api/admin/*`.
- Frontend parser must support this typed shape and permanently support legacy `{ "error": "..." }` shape.

## Typed Error Envelope
```json
{
  "error": {
    "code": "admin_forbidden",
    "message": "Admin access required",
    "details": {
      "path": "/api/admin/projects"
    }
  }
}
```

## Fields
- `error.code` string, required.
- `error.message` string, required.
- `error.details` object, optional.

## Status Mapping
- `400` validation failure.
- `401` missing/invalid auth token.
- `403` authenticated but not permitted.
- `404` resource not found.
- `409` expected write conflict.
- `500` unexpected server failure.

## Code Mapping
- `400` -> `admin_bad_request`
- `401` -> `admin_unauthorized`
- `403` -> `admin_forbidden`
- `404` -> `admin_not_found`
- `409` -> `admin_conflict`
- `500` -> `admin_internal_error`

## Legacy Compatibility
- Legacy shape remains valid for parser compatibility:
```json
{
  "error": "Admin access required"
}
```
