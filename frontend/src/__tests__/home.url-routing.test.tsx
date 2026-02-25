import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeContent } from "@/app/page";

const routerPushMock = vi.fn();
const routerReplaceMock = vi.fn();
let searchParamState: Record<string, string | undefined> = {};

const useWorkspacesMock = vi.fn();
const useConversationMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
  }),
  useSearchParams: () => ({
    get: (key: string) => searchParamState[key] ?? null,
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

vi.mock("@/hooks/useTranscripts", () => ({
  useTranscripts: () => ({
    transcripts: [],
    isLoading: false,
    reload: vi.fn(),
  }),
}));

vi.mock("@/hooks/useWorkspaces", () => ({
  useWorkspaces: () => useWorkspacesMock(),
}));

vi.mock("@/hooks/useConversations", () => ({
  useConversations: () => ({
    conversations: {
      pinned: [],
      today: [],
      yesterday: [],
      two_days_ago: [],
      last_7_days: [],
      last_week: [],
      older: [],
    },
    isLoading: false,
    createConversation: vi.fn(),
    updateConversation: vi.fn(),
    updateConversationTitle: vi.fn(),
    deleteConversation: vi.fn(),
    togglePin: vi.fn(),
  }),
}));

vi.mock("@/hooks/useConversation", () => ({
  useConversation: () => useConversationMock(),
}));

vi.mock("@/hooks/useSearch", () => ({
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

vi.mock("@/hooks/useSidebar", () => ({
  SidebarProvider: ({ children }: { children: unknown }) => createElement("div", null, children),
}));

vi.mock("@/hooks/useTranscriptsPanel", () => ({
  TranscriptsPanelProvider: ({ children }: { children: unknown }) => createElement("div", null, children),
}));

vi.mock("@/components/layout/AppLayout", () => ({
  AppLayout: ({ main }: { main: unknown }) => createElement("div", null, main),
}));

vi.mock("@/components/sidebar/ConversationSidebar", () => ({
  ConversationSidebar: () => createElement("div", null),
}));

vi.mock("@/components/library/TranscriptsPanel", () => ({
  TranscriptsPanel: () => createElement("div", null),
}));

vi.mock("@/components/search/SearchModal", () => ({
  SearchModal: () => createElement("div", null),
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
    searchParamState = {};
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useConversationMock.mockReturnValue({
      messages: [],
      conversationProjectId: null,
      model: "gpt-5.2",
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

    useWorkspacesMock.mockReturnValue({
      clients: [
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
      isLoading: false,
      error: null,
      reload: vi.fn(),
    });
  });

  it("canonicalizes ?project to match the active conversation project", async () => {
    searchParamState = {
      c: "conv-1",
      project: "project-2",
    };
    useConversationMock.mockReturnValue({
      messages: [],
      conversationProjectId: "project-1",
      model: "gpt-5.2",
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
    searchParamState = {
      project: "project-secret",
    };

    await act(async () => {
      root.render(createElement(HomeContent));
      await flush();
    });

    expect(routerReplaceMock).toHaveBeenCalledWith("/", { scroll: false });

    await act(async () => {
      root.unmount();
    });
  });
});
