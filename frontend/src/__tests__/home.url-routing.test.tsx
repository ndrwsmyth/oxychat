import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * After the SharedAppShell refactor, URL canonicalization lives in two places:
 * - SharedAppShell: unauthorized project guard (drops ?project when not visible)
 * - HomeContentInner: conversation-project canonicalization (aligns ?project with conversation's project_id)
 *
 * Since SharedAppShell is globally mocked in test-setup.ts, we test each behaviour
 * through its owning component.
 */

// --- HomeContentInner canonicalization (conversation project mismatch) ---

const routerPushMock = vi.fn();
const routerReplaceMock = vi.fn();

const useConversationMock = vi.fn();
const useAppShellMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("@/hooks/useAuthSetup", () => ({
  useAuthSetup: vi.fn(),
}));

vi.mock("@/hooks/useDrafts", () => ({
  getDraft: vi.fn(() => null),
  saveDraft: vi.fn(),
  clearDraft: vi.fn(),
  cleanupDrafts: vi.fn(),
}));

vi.mock("@/hooks/useConversation", () => ({
  useConversation: () => useConversationMock(),
}));

vi.mock("@/contexts/AppShellContext", () => ({
  useAppShell: () => useAppShellMock(),
  AppShellProvider: ({ children }: { children: unknown }) => createElement("div", null, children),
}));

vi.mock("@/components/OxyHeader", () => ({
  OxyHeader: () => createElement("header", null),
}));

vi.mock("@/components/chat/OxyEmptyState", () => ({
  OxyEmptyState: () => createElement("div", null),
}));

vi.mock("@/components/chat/OxyMessageThread", () => ({
  OxyMessageThread: () => createElement("div", null),
}));

vi.mock("@/components/chat/OxyComposer", () => ({
  OxyComposer: () => createElement("div", null),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("Home URL canonicalization and guard behavior", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useConversationMock.mockReturnValue({
      messages: [],
      conversationProjectId: null,
      model: "gpt-5.4",
      modelOptions: [],
      isModelsReady: true,
      isLoading: false,
      isStreaming: false,
      isThinking: false,
      error: null,
      sendMessage: vi.fn(),
      stopGenerating: vi.fn(),
      changeModel: vi.fn(),
    });

    useAppShellMock.mockReturnValue({
      conversationId: null,
      selectedProjectId: null,
      isAdmin: false,
      workspaceClients: [
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
              conversation_count: 3,
            },
          ],
        },
      ],
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
    });
  });

  it("canonicalizes ?project to match the active conversation project", async () => {
    // HomeContentInner gets conversationId and selectedProjectId from useAppShell
    useAppShellMock.mockReturnValue({
      conversationId: "conv-1",
      selectedProjectId: "project-2",
      isAdmin: false,
      workspaceClients: [],
      conversations: { pinned: [], today: [], yesterday: [], two_days_ago: [], last_7_days: [], last_week: [], older: [] },
      createConversation: vi.fn(),
      updateConversation: vi.fn(),
      updateConversationTitle: vi.fn(),
      deleteConversation: vi.fn(),
      togglePin: vi.fn(),
    });
    useConversationMock.mockReturnValue({
      messages: [],
      conversationProjectId: "project-1",
      model: "gpt-5.4",
      modelOptions: [],
      isModelsReady: true,
      isLoading: false,
      isStreaming: false,
      isThinking: false,
      error: null,
      sendMessage: vi.fn(),
      stopGenerating: vi.fn(),
      changeModel: vi.fn(),
    });

    // Import HomeContent dynamically to get the version with SharedAppShell wrapper
    // Since SharedAppShell is globally mocked, we render HomeContent which wraps HomeContentInner
    const { HomeContent } = await import("@/app/HomeContent");

    await act(async () => {
      root.render(createElement(HomeContent));
      await flush();
    });

    expect(routerReplaceMock).toHaveBeenCalledWith("/?c=conv-1&project=project-1", { scroll: false });

    await act(async () => {
      root.unmount();
    });
  });

  it("drops unauthorized project selection when no conversation is active", async () => {
    // This guard now lives in SharedAppShell, which is globally mocked.
    // We test it by importing SharedAppShell directly and unmocking it for this test.
    // Instead, we verify that the guard behavior is preserved by testing SharedAppShell directly.

    // For this test, we import the real SharedAppShell module
    vi.doUnmock("@/components/layout/SharedAppShell");

    // Mock all SharedAppShell dependencies
    vi.doMock("@/hooks/useAuthSetup", () => ({
      useAuthSetup: vi.fn(),
    }));
    vi.doMock("@/hooks/useAdminSession", () => ({
      useAdminSession: () => ({ isAdmin: false, isLoading: false, error: null, reload: vi.fn() }),
    }));
    vi.doMock("@/hooks/useSidebar", () => ({
      SidebarProvider: ({ children }: { children: unknown }) => createElement("div", null, children),
    }));
    vi.doMock("@/hooks/useTranscriptsPanel", () => ({
      TranscriptsPanelProvider: ({ children }: { children: unknown }) => createElement("div", null, children),
    }));
    vi.doMock("@/components/layout/AppLayout", () => ({
      AppLayout: ({ main }: { main: unknown }) => createElement("div", null, main),
    }));
    vi.doMock("@/components/sidebar/ConversationSidebar", () => ({
      ConversationSidebar: () => createElement("div", null),
    }));
    vi.doMock("@/components/library/TranscriptsPanel", () => ({
      TranscriptsPanel: () => createElement("div", null),
    }));
    vi.doMock("@/components/search/SearchModal", () => ({
      SearchModal: () => createElement("div", null),
    }));
    vi.doMock("@/hooks/useTranscripts", () => ({
      useTranscripts: () => ({ transcripts: [], isLoading: false, reload: vi.fn() }),
    }));
    vi.doMock("@/hooks/useConversations", () => ({
      useConversations: () => ({
        conversations: { pinned: [], today: [], yesterday: [], two_days_ago: [], last_7_days: [], last_week: [], older: [] },
        isLoading: false,
        createConversation: vi.fn(),
        updateConversation: vi.fn(),
        updateConversationTitle: vi.fn(),
        deleteConversation: vi.fn(),
        togglePin: vi.fn(),
      }),
    }));
    vi.doMock("@/hooks/useWorkspaces", () => ({
      useWorkspaces: () => ({
        clients: [
          {
            id: "client-1",
            name: "Acme",
            scope: "client",
            projects: [{ id: "project-1", name: "Acme Core", scope: "client", client_id: "client-1", conversation_count: 3 }],
          },
        ],
        isLoading: false,
        error: null,
        reload: vi.fn(),
      }),
    }));
    vi.doMock("@/hooks/useSearch", () => ({
      useSearch: () => ({
        isOpen: false,
        setIsOpen: vi.fn(),
        query: "",
        setQuery: vi.fn(),
        localResults: [],
        isSearchingDeeper: false,
        selectedIndex: 0,
        setSelectedIndex: vi.fn(),
      }),
    }));

    // Mock useSearchParams to return the unauthorized project
    vi.doMock("next/navigation", () => ({
      useRouter: () => ({ push: routerPushMock, replace: routerReplaceMock }),
      useSearchParams: () => ({
        get: (key: string) => (key === "project" ? "project-secret" : null),
      }),
      usePathname: () => "/",
    }));

    const { SharedAppShell } = await import("@/components/layout/SharedAppShell");

    await act(async () => {
      root.render(createElement(SharedAppShell, null, createElement("div", null)));
      await flush();
    });

    expect(routerReplaceMock).toHaveBeenCalledWith("/", { scroll: false });

    await act(async () => {
      root.unmount();
    });

    // Restore the global mock
    vi.doMock("@/components/layout/SharedAppShell", () => ({
      SharedAppShell: ({ children }: { children: unknown }) =>
        createElement("div", { "data-testid": "shared-app-shell" }, children),
    }));
  });
});
