import { act, createElement, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OxyMentionPopover,
  type MentionPopoverHandle,
} from "@/components/mentions/OxyMentionPopover";
import type { Transcript } from "@/types";

vi.mock("@radix-ui/react-popover", () => ({
  Root: ({ children }: { children: unknown }) => createElement("div", null, children),
  Anchor: ({ children }: { children: unknown }) => createElement("div", null, children),
  Portal: ({ children }: { children: unknown }) => createElement("div", null, children),
  Content: ({
    children,
    className,
  }: {
    children: unknown;
    className?: string;
  }) => createElement("div", { className }, children),
}));

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("OxyMentionPopover scope badges", () => {
  let container: HTMLDivElement;
  let root: Root;

  const transcripts: Transcript[] = [
    {
      id: "project-doc",
      title: "Project Transcript",
      date: new Date("2026-02-25T00:00:00.000Z"),
      scope_bucket: "project",
    },
    {
      id: "global-doc",
      title: "Global Transcript",
      date: new Date("2026-02-24T00:00:00.000Z"),
      scope_bucket: "global",
    },
  ];

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it("renders Project and Global badges in a flat list", async () => {
    await act(async () => {
      root.render(
        createElement(
          OxyMentionPopover,
          {
            open: true,
            onOpenChange: vi.fn(),
            transcripts,
            onSelect: vi.fn(),
          },
          createElement("div", null, "anchor")
        )
      );
    });

    const badges = Array.from(container.querySelectorAll(".oxy-mention-badge")).map((node) => node.textContent);
    expect(badges).toEqual(["Project", "Global"]);
  });

  it("keeps keyboard navigation and enter-select behavior", async () => {
    const onSelect = vi.fn();
    const ref = createRef<MentionPopoverHandle>();
    const onOpenChange = vi.fn();

    await act(async () => {
      root.render(
        createElement(
          OxyMentionPopover,
          {
            ref,
            open: true,
            onOpenChange,
            transcripts,
            onSelect,
          },
          createElement("div", null, "anchor")
        )
      );
    });

    const arrowDownEvent = {
      key: "ArrowDown",
      preventDefault: vi.fn(),
    } as unknown as { key: string; preventDefault: () => void };
    const enterEvent = {
      key: "Enter",
      preventDefault: vi.fn(),
    } as unknown as { key: string; preventDefault: () => void };

    act(() => {
      ref.current?.handleKeyDown(arrowDownEvent);
    });
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      ref.current?.handleKeyDown(enterEvent);
    });

    expect(onSelect).toHaveBeenCalledWith(transcripts[1]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
