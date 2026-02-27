import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMentionSearch } from "@/hooks/useMentionSearch";
import { queryMentionTranscripts } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    queryMentionTranscripts: vi.fn(),
  };
});

function Harness({
  query,
  projectId,
  conversationId,
}: {
  query: string;
  projectId?: string;
  conversationId?: string;
}) {
  const result = useMentionSearch(query, projectId, conversationId);
  return createElement(
    "div",
    {
      "data-loading": result.isLoading ? "1" : "0",
      "data-mode": result.mode,
      "data-count": String(result.transcripts.length),
    },
    result.transcripts.map((item) => item.id).join(",")
  );
}

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("useMentionSearch", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
  });

  it("debounces mention requests", async () => {
    vi.mocked(queryMentionTranscripts).mockResolvedValue({
      transcripts: [],
      mode: "global_only",
      tookMs: 3.2,
    });

    await act(async () => {
      root.render(createElement(Harness, { query: "pla", projectId: "project-1" }));
    });

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(vi.mocked(queryMentionTranscripts)).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(80);
    });
    expect(vi.mocked(queryMentionTranscripts)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(queryMentionTranscripts)).toHaveBeenCalledWith(
      "pla",
      expect.objectContaining({ projectId: "project-1" })
    );
  });

  it("cancels stale requests when query changes", async () => {
    const resolvers: Array<(value: Awaited<ReturnType<typeof queryMentionTranscripts>>) => void> = [];
    vi.mocked(queryMentionTranscripts).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );

    await act(async () => {
      root.render(createElement(Harness, { query: "a", conversationId: "conv-1" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(180);
    });

    await act(async () => {
      root.render(createElement(Harness, { query: "ab", conversationId: "conv-1" }));
    });
    await act(async () => {
      vi.advanceTimersByTime(180);
    });

    const firstCallSignal = vi.mocked(queryMentionTranscripts).mock.calls[0]?.[1]?.signal;
    expect(firstCallSignal?.aborted).toBe(true);

    await act(async () => {
      resolvers[0]?.({
        transcripts: [{ id: "old", title: "Old", date: "2026-02-20T00:00:00.000Z", scope_bucket: "global" }],
        mode: "global_only",
        tookMs: 12,
      });
      await Promise.resolve();
    });

    await act(async () => {
      resolvers[1]?.({
        transcripts: [{ id: "new", title: "New", date: "2026-02-21T00:00:00.000Z", scope_bucket: "project" }],
        mode: "project_global",
        tookMs: 8,
      });
      await Promise.resolve();
    });

    expect(container.textContent).toBe("new");
  });
});
