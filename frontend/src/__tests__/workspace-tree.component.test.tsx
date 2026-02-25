import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceTree } from "@/components/sidebar/WorkspaceTree";
import type { WorkspaceTreeClient } from "@/types";

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const fixtureClients: WorkspaceTreeClient[] = [
  {
    id: "client-1",
    name: "Acme",
    scope: "client",
    projects: [
      {
        id: "project-1",
        name: "Acme Core",
        scope: "client",
        client_id: "client-1",
        conversation_count: 12,
      },
    ],
  },
  {
    id: "client-2",
    name: "Bravo",
    scope: "client",
    projects: [
      {
        id: "project-2",
        name: "Bravo Design",
        scope: "client",
        client_id: "client-2",
        conversation_count: 7,
      },
      {
        id: "project-3",
        name: "Bravo Platform",
        scope: "client",
        client_id: "client-2",
        conversation_count: 3,
      },
    ],
  },
];

describe("WorkspaceTree component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("renders flattened single-project clients and grouped multi-project clients", async () => {
    const onSelectProject = vi.fn();

    await act(async () => {
      root.render(
        createElement(WorkspaceTree, {
          clients: fixtureClients,
          selectedProjectId: null,
          onSelectProject,
          isLoading: false,
        })
      );
    });

    // Only the multi-project client should render a client row label.
    expect(container.querySelectorAll(".oxy-workspace-client-row")).toHaveLength(1);
    const clientLabels = Array.from(container.querySelectorAll(".oxy-workspace-client-name")).map((node) =>
      node.textContent?.trim()
    );
    expect(clientLabels).toEqual(["Bravo"]);
    // Project counts remain visible and stable.
    expect(container.textContent).toContain("12");
    expect(container.textContent).toContain("7");
    expect(container.textContent).toContain("3");

    await act(async () => {
      root.unmount();
    });
  });

  it("selects a project and toggles it off when clicking the active project", async () => {
    const onSelectProject = vi.fn();

    await act(async () => {
      root.render(
        createElement(WorkspaceTree, {
          clients: fixtureClients,
          selectedProjectId: null,
          onSelectProject,
          isLoading: false,
        })
      );
    });

    const acmeButton = container.querySelector(
      'button[aria-label="Open Acme / Acme Core"]'
    ) as HTMLButtonElement | null;
    expect(acmeButton).not.toBeNull();
    acmeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelectProject).toHaveBeenNthCalledWith(1, "project-1");

    await act(async () => {
      root.render(
        createElement(WorkspaceTree, {
          clients: fixtureClients,
          selectedProjectId: "project-1",
          onSelectProject,
          isLoading: false,
        })
      );
    });

    const activeButton = container.querySelector(
      'button[aria-label="Open Acme / Acme Core"]'
    ) as HTMLButtonElement | null;
    activeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelectProject).toHaveBeenNthCalledWith(2, null);

    await act(async () => {
      root.unmount();
    });
  });
});
