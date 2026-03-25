import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";
import { useAdminConsoleData } from "@/hooks/useAdminConsoleData";
import type { AdminClient, AdminProject } from "@/lib/api";

vi.mock("@/components/admin/ProjectsTableEditor", () => ({
  ProjectsTableEditor: () => createElement("div", { "data-testid": "projects-table-editor-mock" }),
}));

vi.mock("@/components/admin/ProjectOverviewEditor", () => ({
  ProjectOverviewEditor: () => createElement("div", { "data-testid": "project-overview-editor-mock" }),
}));

vi.mock("@/components/admin/TranscriptLinkEditor", () => ({
  TranscriptLinkEditor: () => createElement("div", { "data-testid": "transcript-link-editor-mock" }),
}));

vi.mock("@/hooks/useAdminConsoleData", () => ({
  useAdminConsoleData: vi.fn(),
}));

const useAdminConsoleDataMock = vi.mocked(useAdminConsoleData);

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Admin shell skeleton", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const clients: AdminClient[] = [
      {
        id: "client-1",
        name: "Acme",
        scope: "client",
        owner_user_id: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];
    const projects: AdminProject[] = [
      {
        id: "project-1",
        client_id: "client-1",
        name: "Acme Core",
        scope: "client",
        owner_user_id: null,
        is_inbox: false,
        overview_markdown: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];

    useAdminConsoleDataMock.mockReturnValue({
      clients,
      projects,
      isLoading: false,
      isMutating: false,
      error: null,
      reload: vi.fn(),
      createProject: vi.fn(async () => undefined),
      updateProject: vi.fn(async () => undefined),
      removeProject: vi.fn(async () => undefined),
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("renders projects by default and toggles to audit tab", async () => {
    await act(async () => {
      root.render(createElement(AdminPage));
    });

    expect(container.querySelector("[data-testid='admin-shell']")).not.toBeNull();
    expect(container.querySelector("[data-testid='admin-projects-editor']")).not.toBeNull();
    expect(container.querySelector("[data-testid='admin-tab-users']")).toBeNull();
    expect(container.querySelector("[data-testid='projects-table-editor-mock']")).not.toBeNull();
    expect(container.querySelector("[data-testid='project-overview-editor-mock']")).not.toBeNull();
    // Transcript relink is now its own tab, not inside projects
    expect(container.querySelector("[data-testid='transcript-link-editor-mock']")).toBeNull();

    // Switch to relink tab
    const relinkTab = container.querySelector(
      "button[data-testid='admin-tab-relink']"
    ) as HTMLButtonElement | null;
    expect(relinkTab).not.toBeNull();
    await act(async () => {
      relinkTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(container.querySelector("[data-testid='admin-relink-editor']")).not.toBeNull();
    expect(container.querySelector("[data-testid='transcript-link-editor-mock']")).not.toBeNull();

    // Switch to audit tab
    const auditTab = container.querySelector(
      "button[data-testid='admin-tab-audit']"
    ) as HTMLButtonElement | null;
    expect(auditTab).not.toBeNull();
    await act(async () => {
      auditTab?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector("[data-testid='admin-projects-editor']")).toBeNull();
    expect(container.querySelector("[data-testid='admin-audit-editor']")).not.toBeNull();
  });
});
