import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptsPanel } from "@/components/library/TranscriptsPanel";
import type { Transcript } from "@/types";

const setOpenMock = vi.fn();

vi.mock("@/hooks/useTranscriptsPanel", () => ({
  useTranscriptsPanel: () => ({
    setOpen: setOpenMock,
  }),
}));

vi.mock("@radix-ui/react-scroll-area", () => ({
  Root: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
  Viewport: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
  Scrollbar: ({ children, className }: { children: unknown; className?: string }) =>
    createElement("div", { className }, children),
  Thumb: ({ className }: { className?: string }) => createElement("div", { className }),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("TranscriptsPanel tags", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("renders client and project tags from transcript DTO contract", async () => {
    const transcripts: Transcript[] = [
      {
        id: "t-1",
        title: "Weekly planning",
        date: new Date("2026-02-20T10:00:00.000Z"),
        summary: "Summary",
        client_tag: { id: "c-1", name: "Acme", scope: "client" },
        project_tag: { id: "p-1", name: "Acme Core", scope: "client" },
      },
    ];

    await act(async () => {
      root.render(createElement(TranscriptsPanel, { transcripts, isLoading: false }));
    });

    const tags = Array.from(container.querySelectorAll(".oxy-transcripts-tag")).map((node) => node.textContent);
    expect(tags).toEqual(["Acme", "Acme Core"]);

    await act(async () => {
      root.unmount();
    });
  });
});
