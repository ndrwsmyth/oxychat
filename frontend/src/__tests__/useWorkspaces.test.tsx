import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, createElement, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { fetchWorkspaces } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  fetchWorkspaces: vi.fn(),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function HookHarness({
  onChange,
}: {
  onChange: (value: ReturnType<typeof useWorkspaces>) => void;
}) {
  const value = useWorkspaces();
  useEffect(() => {
    onChange(value);
  }, [onChange, value]);
  return null;
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("useWorkspaces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads workspace tree data", async () => {
    vi.mocked(fetchWorkspaces).mockResolvedValue({
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
              conversation_count: 2,
            },
          ],
        },
      ],
    });

    let latest: ReturnType<typeof useWorkspaces> | null = null;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root: Root = createRoot(container);

    await act(async () => {
      root.render(createElement(HookHarness, { onChange: (value) => { latest = value; } }));
      await flush();
    });

    expect(latest?.isLoading).toBe(false);
    expect(latest?.clients).toHaveLength(1);
    expect(latest?.clients[0].projects[0].id).toBe("project-1");

    await act(async () => {
      root.unmount();
    });
  });
});
