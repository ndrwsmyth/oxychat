"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminAudit, type AdminAuditEventView } from "@/lib/api";

function getEventLabel(eventType: string): string {
  if (eventType === "transcript.routed.preserved") {
    return "Manual route preserved";
  }
  return eventType;
}

export function AdminAuditTimeline() {
  const [items, setItems] = useState<AdminAuditEventView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [includeBench, setIncludeBench] = useState(false);

  const loadTimeline = useCallback(
    async (cursor: string | null, append: boolean) => {
      try {
        setIsLoading(true);
        const response = await fetchAdminAudit({
          limit: 25,
          cursor,
          includeBench,
        });
        setItems((previous) => (append ? [...previous, ...response.items] : response.items));
        setNextCursor(response.next_cursor);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load admin audit timeline");
      } finally {
        setIsLoading(false);
      }
    },
    [includeBench]
  );

  useEffect(() => {
    void loadTimeline(null, false);
  }, [loadTimeline]);

  return (
    <section data-testid="admin-audit-timeline">
      <h2 className="oxy-admin-section-title">Audit Timeline</h2>
      <p className="oxy-admin-section-desc">Review admin audit events with per-viewer redaction markers.</p>

      <label className="oxy-admin-checkbox-label oxy-admin-mt-sm">
        <input
          type="checkbox"
          checked={includeBench}
          onChange={(event) => setIncludeBench(event.target.checked)}
          data-testid="admin-audit-include-bench"
        />
        Include benchmark events
      </label>

      {error ? (
        <p role="alert" data-testid="admin-audit-error" className="oxy-admin-error oxy-admin-mt-sm">
          {error}
        </p>
      ) : null}

      {isLoading && items.length === 0 ? (
        <p data-testid="admin-audit-loading" className="oxy-admin-status oxy-admin-mt-sm">
          Loading audit events...
        </p>
      ) : null}

      <ul className="oxy-admin-audit-list oxy-admin-mt-base">
        {items.map((item) => (
          <li
            key={item.id}
            data-testid={`admin-audit-item-${item.id}`}
            className="oxy-admin-audit-item"
          >
            <div className="oxy-admin-audit-type">{getEventLabel(item.event_type)}</div>
            <div className="oxy-admin-audit-time">{new Date(item.created_at).toLocaleString()}</div>
            {item.redacted ? (
              <div data-testid={`admin-audit-redacted-${item.id}`} className="oxy-admin-audit-redacted">
                Redacted for private transcript visibility.
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void loadTimeline(nextCursor, true)}
          disabled={isLoading}
          className="oxy-admin-btn oxy-admin-btn-primary oxy-admin-mt-sm"
          data-testid="admin-audit-load-more"
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}
