import { createElement } from "react";
import { vi } from "vitest";

if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

vi.mock("@/components/layout/SharedAppShell", () => ({
  SharedAppShell: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "shared-app-shell" }, children),
}));

vi.mock("@/contexts/AppShellContext", () => ({
  useAppShell: () => ({
    conversationId: null,
    selectedProjectId: null,
    isAdmin: false,
    workspaceClients: [],
    conversations: {
      pinned: [],
      today: [],
      yesterday: [],
      two_days_ago: [],
      last_7_days: [],
      last_week: [],
      older: [],
    },
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    deleteConversation: vi.fn(),
    togglePin: vi.fn(),
  }),
  AppShellProvider: ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children),
}));
