import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAuditTimeline } from "@/components/admin/AdminAuditTimeline";
import { fetchAdminAudit } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    fetchAdminAudit: vi.fn(),
  };
});

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("AdminAuditTimeline", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("renders transcript.routed.preserved with labeled event text", async () => {
    vi.mocked(fetchAdminAudit).mockResolvedValue({
      items: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          actor_user_id: "00000000-0000-4000-8000-000000000002",
          event_type: "transcript.routed.preserved",
          entity_type: "transcript",
          entity_id: "00000000-0000-4000-8000-000000000003",
          request_id: "req-1",
          payload: { project_id: "00000000-0000-4000-8000-000000000004" },
          created_at: "2026-03-02T00:00:00.000Z",
          redacted: false,
          redaction_reason: null,
        },
      ],
      next_cursor: null,
    });

    await act(async () => {
      root.render(createElement(AdminAuditTimeline));
      await flush();
      await flush();
    });

    expect(container.querySelector("[data-testid='admin-audit-timeline']")).not.toBeNull();
    expect(container.textContent).toContain("Manual route preserved");
  });
});
