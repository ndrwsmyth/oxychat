import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectOverviewEditor } from "@/components/admin/ProjectOverviewEditor";
import type { AdminProject } from "@/lib/api";

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(textarea, value);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("ProjectOverviewEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("loads selected project overview and saves markdown edits", async () => {
    const projects: AdminProject[] = [
      {
        id: "project-1",
        client_id: "client-1",
        name: "Acme Core",
        scope: "client",
        owner_user_id: null,
        is_inbox: false,
        overview_markdown: "## Existing overview",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];
    const saveOverview = vi.fn(async () => undefined);

    await act(async () => {
      root.render(
        createElement(ProjectOverviewEditor, {
          projects,
          isLoading: false,
          isSaving: false,
          error: null,
          selectedProjectId: "project-1",
          onSelectProject: vi.fn(),
          onSaveOverview: saveOverview,
        })
      );
    });

    const textarea = container.querySelector(
      "[data-testid='admin-overview-markdown']"
    ) as HTMLTextAreaElement | null;
    const saveButton = container.querySelector(
      "[data-testid='admin-overview-save']"
    ) as HTMLButtonElement | null;

    expect(textarea?.value).toBe("## Existing overview");

    await act(async () => {
      if (textarea) {
        setTextareaValue(textarea, "## Updated overview");
      }
    });

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(saveOverview).toHaveBeenCalledWith("project-1", "## Updated overview");
    expect(container.querySelector("[data-testid='admin-overview-saved']")).not.toBeNull();
  });
});
