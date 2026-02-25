import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConversationSidebar } from "@/components/sidebar/ConversationSidebar";
import type { GroupedConversations } from "@/types";

const pushMock = vi.fn();
const toggleMock = vi.fn();
const useSidebarMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/useSidebar", () => ({
  useSidebar: () => useSidebarMock(),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
}));

vi.mock("@/components/sidebar/UserAvatar", () => ({
  UserAvatar: ({ collapsed }: { collapsed?: boolean }) =>
    createElement("div", { "data-testid": collapsed ? "avatar-collapsed" : "avatar-expanded" }),
}));

vi.mock("@/components/sidebar/IOSThemeToggle", () => ({
  IOSThemeToggle: () => createElement("div", { "data-testid": "theme-toggle" }),
}));

vi.mock("@/components/sidebar/WorkspaceTree", () => ({
  WorkspaceTree: () => createElement("div", { className: "workspace-tree-stub" }),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const emptyConversations: GroupedConversations = {
  pinned: [],
  today: [],
  yesterday: [],
  two_days_ago: [],
  last_7_days: [],
  last_week: [],
  older: [],
};

function buildSidebar() {
  return createElement(ConversationSidebar, {
    activeConversationId: null,
    selectedProjectId: null,
    conversations: emptyConversations,
    workspaceClients: [],
    workspacesLoading: false,
    onSelectProject: vi.fn(),
    isLoading: false,
    onNewChat: vi.fn(),
    onOpenSearch: vi.fn(),
    onUpdateConversation: vi.fn(async () => undefined),
    onDeleteConversation: vi.fn(async () => undefined),
    onTogglePin: vi.fn(async () => undefined),
  });
}

describe("ConversationSidebar motion hardening", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(async () => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  async function renderWithCollapsed(collapsed: boolean) {
    useSidebarMock.mockReturnValue({
      collapsed,
      toggle: toggleMock,
    });

    await act(async () => {
      root.render(buildSidebar());
    });
  }

  it("keeps expanded region mounted across collapse transitions", async () => {
    await renderWithCollapsed(false);
    expect(container.querySelector(".oxy-rail-expanded-region")).not.toBeNull();

    await renderWithCollapsed(true);
    expect(container.querySelector(".oxy-rail-expanded-region")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("reflects collapsed/expanded class changes immediately without timer dependency", async () => {
    await renderWithCollapsed(false);
    expect(container.querySelector(".oxy-sidebar-rail")?.classList.contains("expanded")).toBe(true);
    expect(container.querySelector(".oxy-sidebar-rail")?.classList.contains("collapsed")).toBe(false);

    await renderWithCollapsed(true);
    expect(container.querySelector(".oxy-sidebar-rail")?.classList.contains("collapsed")).toBe(true);
    expect(container.querySelector(".oxy-sidebar-rail")?.classList.contains("expanded")).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders collapsed avatar-only footer state", async () => {
    await renderWithCollapsed(true);
    expect(container.querySelector(".oxy-rail-footer-collapsed")).toBeNull();
    expect(container.querySelector(".oxy-rail-footer")).not.toBeNull();
    expect(container.querySelector(".oxy-rail-footer-theme")).not.toBeNull();
    expect(container.querySelector('[data-testid="avatar-collapsed"]')).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps collapse control to the right of theme toggle", async () => {
    await renderWithCollapsed(false);
    const footer = container.querySelector(".oxy-rail-footer");
    const themeToggle = footer?.querySelector('[data-testid="theme-toggle"]');
    const collapseButton = footer?.querySelector(".oxy-rail-collapse");

    expect(themeToggle).not.toBeNull();
    expect(collapseButton).not.toBeNull();
    expect(container.querySelector(".oxy-rail-footer-theme")?.nextElementSibling).toBe(collapseButton);

    await act(async () => {
      root.unmount();
    });
  });

  it("toggles from empty rail background clicks", async () => {
    await renderWithCollapsed(false);
    const rail = container.querySelector(".oxy-sidebar-rail");
    rail?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggleMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });
});
