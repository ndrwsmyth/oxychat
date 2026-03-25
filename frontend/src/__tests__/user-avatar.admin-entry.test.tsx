import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserAvatar } from "@/components/sidebar/UserAvatar";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      firstName: "Admin",
      lastName: "User",
      fullName: "Admin User",
      imageUrl: null,
      emailAddresses: [{ emailAddress: "admin@oxy.so" }],
    },
  }),
  useClerk: () => ({
    signOut: vi.fn(),
  }),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: unknown }) => createElement("div", null, children),
  PopoverTrigger: ({ children }: { children: unknown }) => createElement("div", null, children),
  PopoverContent: ({ children }: { children: unknown }) => createElement("div", null, children),
}));

vi.mock("@/components/modals/SettingsModal", () => ({
  SettingsModal: () => null,
}));

vi.mock("@/components/modals/KeyboardShortcutsModal", () => ({
  KeyboardShortcutsModal: () => null,
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("UserAvatar admin menu entry", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("shows admin console menu item when enabled", async () => {
    await act(async () => {
      root.render(createElement(UserAvatar, { showAdminEntry: true }));
    });

    const adminEntry = container.querySelector("[data-testid='user-menu-admin-entry']");
    expect(adminEntry).not.toBeNull();

    await act(async () => {
      adminEntry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(pushMock).toHaveBeenCalledWith("/admin");
  });

  it("hides admin console menu item when disabled", async () => {
    await act(async () => {
      root.render(createElement(UserAvatar, { showAdminEntry: false }));
    });

    expect(container.querySelector("[data-testid='user-menu-admin-entry']")).toBeNull();
  });
});
