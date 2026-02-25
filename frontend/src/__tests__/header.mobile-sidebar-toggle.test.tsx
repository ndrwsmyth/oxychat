import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OxyHeader } from "@/components/OxyHeader";

const pushMock = vi.fn();
const toggleSidebarMock = vi.fn();
const useSidebarMock = vi.fn();
const toggleTranscriptsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/useSidebar", () => ({
  useSidebar: () => useSidebarMock(),
}));

vi.mock("@/hooks/useTranscriptsPanel", () => ({
  useTranscriptsPanel: () => ({
    open: false,
    toggle: toggleTranscriptsMock,
  }),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("OxyHeader mobile sidebar toggle", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("renders open-sidebar control when collapsed", async () => {
    useSidebarMock.mockReturnValue({
      collapsed: true,
      toggle: toggleSidebarMock,
    });

    await act(async () => {
      root.render(createElement(OxyHeader, { showHomeButton: false }));
    });

    expect(container.querySelector(".oxy-bar-sidebar-toggle")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("clicking mobile open control toggles sidebar", async () => {
    useSidebarMock.mockReturnValue({
      collapsed: true,
      toggle: toggleSidebarMock,
    });

    await act(async () => {
      root.render(createElement(OxyHeader, { showHomeButton: false }));
    });

    const toggleButton = container.querySelector(".oxy-bar-sidebar-toggle");
    toggleButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(toggleSidebarMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("renders breadcrumb context when provided", async () => {
    useSidebarMock.mockReturnValue({
      collapsed: false,
      toggle: toggleSidebarMock,
    });

    await act(async () => {
      root.render(
        createElement(OxyHeader, {
          showHomeButton: true,
          breadcrumb: {
            clientName: "Acme",
            projectName: "Platform",
          },
        })
      );
    });

    const breadcrumb = container.querySelector(".oxy-breadcrumb");
    expect(breadcrumb).not.toBeNull();
    expect(breadcrumb?.textContent).toContain("Acme");
    expect(breadcrumb?.textContent).toContain("/");
    expect(breadcrumb?.textContent).toContain("Platform");

    await act(async () => {
      root.unmount();
    });
  });
});
