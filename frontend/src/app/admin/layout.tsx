"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminSession } from "@/hooks/useAdminSession";
import { SharedAppShell } from "@/components/layout/SharedAppShell";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAdmin, isLoading, error, reload } = useAdminSession();
  const isAuthDenied = error?.status === 401 || error?.status === 403;
  const isForbidden = !isLoading && (isAuthDenied || (!error && !isAdmin));
  const isSessionError = !isLoading && Boolean(error) && !isAuthDenied;

  useEffect(() => {
    if (isForbidden) {
      const timeout = window.setTimeout(() => {
        router.replace("/");
      }, 1500);
      return () => window.clearTimeout(timeout);
    }
  }, [isForbidden, router]);

  if (isLoading) {
    return (
      <div className="oxy-admin-guard" data-testid="admin-guard-loading" role="status" aria-label="Loading admin session">
        <div className="oxy-admin-guard-card">
          <p className="oxy-admin-eyebrow">Admin Console</p>
          <h1 className="oxy-admin-heading">Preparing workspace</h1>
          <p className="oxy-admin-muted">Checking admin access and loading console data.</p>
        </div>
      </div>
    );
  }

  if (isSessionError) {
    return (
      <div className="oxy-admin-guard" data-testid="admin-guard-session-error">
        <div className="oxy-admin-guard-card">
          <p className="oxy-admin-eyebrow">Admin Console</p>
          <h1 className="oxy-admin-heading">Session error</h1>
          <p className="oxy-admin-muted">{error?.message ?? "Failed to verify your session."}</p>
          <div className="oxy-admin-actions">
            <button
              type="button"
              className="oxy-admin-btn oxy-admin-btn-primary"
              onClick={() => void reload()}
              data-testid="admin-guard-retry"
            >
              Retry
            </button>
            <button
              type="button"
              className="oxy-admin-btn"
              onClick={() => router.replace("/")}
            >
              Back to chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="oxy-admin-guard" data-testid="admin-guard-forbidden">
        <div className="oxy-admin-guard-card">
          <p className="oxy-admin-eyebrow">Admin Console</p>
          <h1 className="oxy-admin-heading">Access restricted</h1>
          <p className="oxy-admin-muted">You do not have admin access. Redirecting to chat...</p>
          <button
            type="button"
            className="oxy-admin-btn"
            onClick={() => router.replace("/")}
          >
            Go now
          </button>
        </div>
      </div>
    );
  }

  return (
    <SharedAppShell>
      {children}
    </SharedAppShell>
  );
}
