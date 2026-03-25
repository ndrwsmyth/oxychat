import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminLayout from "@/app/admin/layout";

const replaceMock = vi.fn();
const useAdminSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/hooks/useAdminSession", () => ({
  useAdminSession: () => useAdminSessionMock(),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("Admin route guard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders loading placeholder while role is unresolved", async () => {
    useAdminSessionMock.mockReturnValue({
      isAdmin: false,
      isLoading: true,
      error: null,
      reload: vi.fn(),
    });

    await act(async () => {
      root.render(
        createElement(
          AdminLayout,
          null,
          createElement("div", { "data-testid": "privileged" }, "privileged")
        )
      );
    });

    expect(container.querySelector("[data-testid='admin-guard-loading']")).not.toBeNull();
    expect(container.querySelector("[data-testid='privileged']")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("redirects members and hides privileged children", async () => {
    useAdminSessionMock.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      error: null,
      reload: vi.fn(),
    });

    await act(async () => {
      root.render(
        createElement(
          AdminLayout,
          null,
          createElement("div", { "data-testid": "privileged" }, "privileged")
        )
      );
    });

    expect(container.querySelector("[data-testid='admin-guard-forbidden']")).not.toBeNull();
    await act(async () => {
      vi.advanceTimersByTime(1600);
    });
    expect(replaceMock).toHaveBeenCalledWith("/");
    expect(container.querySelector("[data-testid='privileged']")).toBeNull();
  });

  it("renders children for admin role", async () => {
    useAdminSessionMock.mockReturnValue({
      isAdmin: true,
      isLoading: false,
      error: null,
      reload: vi.fn(),
    });

    await act(async () => {
      root.render(
        createElement(
          AdminLayout,
          null,
          createElement("div", { "data-testid": "privileged" }, "privileged")
        )
      );
    });

    expect(container.querySelector("[data-testid='privileged']")).not.toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("renders explicit session error state for non-auth failures", async () => {
    useAdminSessionMock.mockReturnValue({
      isAdmin: false,
      isLoading: false,
      error: {
        message: "Admin session fetch failed",
        status: 500,
      },
      reload: vi.fn(),
    });

    await act(async () => {
      root.render(
        createElement(
          AdminLayout,
          null,
          createElement("div", { "data-testid": "privileged" }, "privileged")
        )
      );
    });

    expect(container.querySelector("[data-testid='admin-guard-session-error']")).not.toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
