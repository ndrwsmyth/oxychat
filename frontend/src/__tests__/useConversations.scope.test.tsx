import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useConversations } from "@/hooks/useConversations";
import { createConversation, fetchConversations } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  fetchConversations: vi.fn(),
  createConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  togglePinConversation: vi.fn(),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

interface HookHarnessProps {
  projectId: string | null;
  onChange: (value: ReturnType<typeof useConversations>) => void;
}

function HookHarness({ projectId, onChange }: HookHarnessProps) {
  const value = useConversations({ projectId });
  useEffect(() => {
    onChange(value);
  }, [onChange, value]);
  return null;
}

function groupedConversations(projectId: string) {
  const conversation = {
    id: `conv-${projectId}`,
    title: `Conversation ${projectId}`,
    auto_titled: false,
    model: "gpt-5.2",
    project_id: projectId,
    pinned: false,
    pinned_at: null,
    created_at: new Date("2026-02-20T10:00:00.000Z"),
    updated_at: new Date("2026-02-20T10:00:00.000Z"),
  };

  return {
    pinned: [],
    today: [conversation],
    yesterday: [],
    two_days_ago: [],
    last_7_days: [],
    last_week: [],
    older: [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useConversations project scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads conversations scoped to selected project", async () => {
    vi.mocked(fetchConversations).mockResolvedValue(groupedConversations("project-1"));

    let latest: ReturnType<typeof useConversations> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { projectId: "project-1", onChange: (value) => { latest = value; } }));
      await flush();
    });

    expect(vi.mocked(fetchConversations)).toHaveBeenCalledWith(undefined, "project-1");
    expect(latest?.conversations.today[0].project_id).toBe("project-1");

    await act(async () => {
      root.unmount();
    });
  });

  it("ignores stale responses when project switches quickly", async () => {
    const first = deferred<ReturnType<typeof groupedConversations>>();
    const second = deferred<ReturnType<typeof groupedConversations>>();
    vi.mocked(fetchConversations)
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);

    let latest: ReturnType<typeof useConversations> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { projectId: "project-1", onChange: (value) => { latest = value; } }));
    });

    await act(async () => {
      root.render(createElement(HookHarness, { projectId: "project-2", onChange: (value) => { latest = value; } }));
    });

    await act(async () => {
      second.resolve(groupedConversations("project-2"));
      await flush();
    });
    expect(latest?.conversations.today[0].project_id).toBe("project-2");

    await act(async () => {
      first.resolve(groupedConversations("project-1"));
      await flush();
    });
    expect(latest?.conversations.today[0].project_id).toBe("project-2");

    await act(async () => {
      root.unmount();
    });
  });

  it("creates conversations scoped to the active selected project by default", async () => {
    vi.mocked(fetchConversations).mockResolvedValue(groupedConversations("project-3"));
    vi.mocked(createConversation).mockResolvedValue({
      id: "conv-created",
      title: "Scoped",
      auto_titled: false,
      model: "gpt-5.2",
      project_id: "project-3",
      pinned: false,
      pinned_at: null,
      created_at: new Date("2026-02-20T10:00:00.000Z"),
      updated_at: new Date("2026-02-20T10:00:00.000Z"),
    });

    let latest: ReturnType<typeof useConversations> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { projectId: "project-3", onChange: (value) => { latest = value; } }));
      await flush();
    });

    await act(async () => {
      await latest?.createConversation("Scoped");
    });

    expect(vi.mocked(createConversation)).toHaveBeenCalledWith("Scoped", undefined, "project-3");

    await act(async () => {
      root.unmount();
    });
  });
});
