import type { Context } from 'hono';

export type AdminErrorCode =
  | 'admin_bad_request'
  | 'admin_unauthorized'
  | 'admin_forbidden'
  | 'admin_not_found'
  | 'admin_conflict'
  | 'admin_internal_error';

type AdminErrorDetails = Record<string, unknown>;

interface AdminErrorEnvelope {
  error: {
    code: AdminErrorCode;
    message: string;
    details?: AdminErrorDetails;
  };
}

export function adminError(
  c: Context,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  code: AdminErrorCode,
  message: string,
  details?: AdminErrorDetails
) {
  const payload: AdminErrorEnvelope = {
    error: details
      ? { code, message, details }
      : { code, message },
  };
  return c.json(payload, status);
}

export function adminBadRequest(c: Context, message: string, details?: AdminErrorDetails) {
  return adminError(c, 400, 'admin_bad_request', message, details);
}

export function adminForbidden(c: Context, message: string, details?: AdminErrorDetails) {
  return adminError(c, 403, 'admin_forbidden', message, details);
}

export function adminConflict(c: Context, message: string, details?: AdminErrorDetails) {
  return adminError(c, 409, 'admin_conflict', message, details);
}

export function adminNotFound(c: Context, message: string, details?: AdminErrorDetails) {
  return adminError(c, 404, 'admin_not_found', message, details);
}

export function adminInternalError(c: Context, message: string, details?: AdminErrorDetails) {
  return adminError(c, 500, 'admin_internal_error', message, details);
}
