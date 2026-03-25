export interface ParsedAdminError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  status: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseAdminError(payload: unknown, status: number): ParsedAdminError {
  if (isRecord(payload)) {
    const typedError = payload.error;
    if (isRecord(typedError)) {
      const code = typeof typedError.code === "string" ? typedError.code : "admin_error";
      const message =
        typeof typedError.message === "string" ? typedError.message : `Request failed (${status})`;
      const details = isRecord(typedError.details) ? typedError.details : undefined;
      return { code, message, details, status };
    }

    // Permanent legacy fallback shape: { error: string }
    if (typeof payload.error === "string") {
      return {
        code: "legacy_admin_error",
        message: payload.error,
        status,
      };
    }
  }

  return {
    code: "admin_error",
    message: `Request failed (${status})`,
    status,
  };
}

export function toAdminErrorDisplayMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: string; status?: number };
    switch (candidate.code) {
      case "admin_bad_request":
        return candidate.message || fallback;
      case "admin_forbidden":
        return "This action is blocked by transcript visibility or role policy.";
      case "admin_conflict":
        return "This update conflicted with another admin action. Please retry.";
      default:
        break;
    }

    if (candidate.status === 401) {
      return "Your session expired. Refresh and sign in again.";
    }
    if (candidate.status === 403) {
      return "You do not have access to this admin action.";
    }
    if (candidate.status === 409) {
      return "Another admin is updating this record. Try again in a moment.";
    }

    if (candidate.message) {
      return candidate.message;
    }
  }

  return fallback;
}
