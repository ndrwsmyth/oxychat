import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { ProjectsTableEditor } from "@/components/admin/ProjectsTableEditor";
import type { AdminClient, AdminProject } from "@/lib/api";

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

const clients: AdminClient[] = [
  {
    id: "client-1",
    name: "Acme",
    scope: "client",
    owner_user_id: null,
    created_at: "2026-03-01T00:00:00.000Z",
    updated_at: "2026-03-01T00:00:00.000Z",
  },
  {
    id: "client-2",
    name: "Beacon",
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
  {
    id: "project-2",
    client_id: "client-2",
    name: "Beacon Product",
    scope: "global",
    owner_user_id: null,
    is_inbox: false,
    overview_markdown: null,
    created_at: "2026-03-02T00:00:00.000Z",
    updated_at: "2026-03-02T00:00:00.000Z",
  },
];

function defaultProps(overrides?: Partial<Parameters<typeof ProjectsTableEditor>[0]>) {
  return {
    clients,
    projects,
    isLoading: false,
    isMutating: false,
    error: null,
    onCreateProject: vi.fn(async () => undefined),
    onUpdateProject: vi.fn(async () => undefined),
    onDeleteProject: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("ProjectsTableEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    container.remove();
  });

  it("renders table with projects and resolved client names", async () => {
    const props = defaultProps();
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    expect(container.querySelector("[data-testid='projects-table-editor']")).not.toBeNull();
    expect(container.querySelector("[data-testid='admin-project-row-project-1']")).not.toBeNull();
    expect(container.querySelector("[data-testid='admin-project-row-project-2']")).not.toBeNull();

    // Client names are resolved (not raw IDs)
    const row1 = container.querySelector("[data-testid='admin-project-row-project-1']");
    expect(row1?.textContent).toContain("Acme");
    expect(row1?.textContent).toContain("Acme Core");

    const row2 = container.querySelector("[data-testid='admin-project-row-project-2']");
    expect(row2?.textContent).toContain("Beacon");
  });

  it("filters projects by search query on project name", async () => {
    const props = defaultProps();
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    const search = container.querySelector("[data-testid='admin-projects-search']") as HTMLInputElement;
    expect(search).not.toBeNull();

    await act(async () => {
      setInputValue(search, "beacon");
    });

    // Only Beacon project should be visible
    expect(container.querySelector("[data-testid='admin-project-row-project-1']")).toBeNull();
    expect(container.querySelector("[data-testid='admin-project-row-project-2']")).not.toBeNull();
  });

  it("filters projects by client name", async () => {
    const props = defaultProps();
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    const search = container.querySelector("[data-testid='admin-projects-search']") as HTMLInputElement;

    await act(async () => {
      setInputValue(search, "acme");
    });

    expect(container.querySelector("[data-testid='admin-project-row-project-1']")).not.toBeNull();
    expect(container.querySelector("[data-testid='admin-project-row-project-2']")).toBeNull();
  });

  it("shows scope badges", async () => {
    const props = defaultProps();
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    const badges = container.querySelectorAll(".oxy-admin-badge");
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });

  it("shows empty state when no projects", async () => {
    const props = defaultProps({ projects: [] });
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    expect(container.textContent).toContain("No projects yet");
  });

  it("shows loading state", async () => {
    const props = defaultProps({ isLoading: true });
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    expect(container.querySelector("[data-testid='admin-projects-loading']")).not.toBeNull();
  });

  it("shows error state", async () => {
    const props = defaultProps({ error: "Something broke" });
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    expect(container.querySelector("[data-testid='admin-projects-error']")?.textContent).toBe("Something broke");
  });

  it("opens create row and calls onCreateProject", async () => {
    const props = defaultProps();
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    // Click new project button
    const newBtn = container.querySelector("[data-testid='admin-project-new-btn']") as HTMLButtonElement;
    await act(async () => {
      newBtn.click();
    });

    expect(container.querySelector("[data-testid='admin-project-create-row']")).not.toBeNull();

    // Fill in name
    const nameInput = container.querySelector("[data-testid='admin-project-new-name']") as HTMLInputElement;
    await act(async () => {
      setInputValue(nameInput, "New Project");
    });

    // Select client
    const clientSelect = container.querySelector("[data-testid='admin-project-new-client-select']") as HTMLSelectElement;
    await act(async () => {
      setSelectValue(clientSelect, "client-2");
    });

    // Click confirm
    const confirmBtn = container.querySelector("[data-testid='admin-project-create']") as HTMLButtonElement;
    await act(async () => {
      confirmBtn.click();
    });

    expect(props.onCreateProject).toHaveBeenCalledWith({
      client_id: "client-2",
      name: "New Project",
      scope: "client",
    });
  });

  it("shows project count in header", async () => {
    const props = defaultProps();
    await act(async () => {
      root.render(createElement(ProjectsTableEditor, props));
    });

    const count = container.querySelector(".oxy-admin-table-count");
    expect(count?.textContent).toBe("2");
  });
});
