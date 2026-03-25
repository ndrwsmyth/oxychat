import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TranscriptLinkEditor } from "@/components/admin/TranscriptLinkEditor";
import { relinkAdminTranscript, searchAdminTranscripts } from "@/lib/api";
import type { AdminProject } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    relinkAdminTranscript: vi.fn(),
    searchAdminTranscripts: vi.fn(),
  };
});

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value"
  )?.set;
  valueSetter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("TranscriptLinkEditor", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("searches transcripts and submits relink request", async () => {
    const projects: AdminProject[] = [
      {
        id: "00000000-0000-4000-8000-000000000002",
        client_id: "client-1",
        name: "Acme Core",
        scope: "client",
        owner_user_id: null,
        is_inbox: false,
        overview_markdown: null,
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
      },
    ];

    vi.mocked(searchAdminTranscripts).mockResolvedValue([
      {
        id: "00000000-0000-4000-8000-000000000001",
        title: "Sprint planning",
        date: "2026-03-01T00:00:00.000Z",
      },
    ]);
    vi.mocked(relinkAdminTranscript).mockResolvedValue({
      transcript_id: "00000000-0000-4000-8000-000000000001",
      project_id: "00000000-0000-4000-8000-000000000002",
      link_source: "admin_manual",
      updated_at: "2026-03-02T00:00:00.000Z",
    });

    await act(async () => {
      root.render(
        createElement(TranscriptLinkEditor, {
          projects,
          defaultProjectId: projects[0].id,
        })
      );
    });

    const queryInput = container.querySelector(
      "[data-testid='admin-transcript-search-query']"
    ) as HTMLInputElement | null;
    const searchButton = container.querySelector(
      "[data-testid='admin-transcript-search-submit']"
    ) as HTMLButtonElement | null;
    const relinkButton = container.querySelector(
      "[data-testid='admin-transcript-relink-submit']"
    ) as HTMLButtonElement | null;

    await act(async () => {
      if (queryInput) {
        setInputValue(queryInput, "Sprint");
      }
    });

    await act(async () => {
      searchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const transcriptSelect = container.querySelector(
      "[data-testid='admin-transcript-match-select']"
    ) as HTMLSelectElement | null;
    const projectSelect = container.querySelector(
      "[data-testid='admin-transcript-project-select']"
    ) as HTMLSelectElement | null;

    expect(transcriptSelect).not.toBeNull();
    expect(projectSelect).not.toBeNull();

    await act(async () => {
      if (transcriptSelect) {
        setSelectValue(transcriptSelect, "00000000-0000-4000-8000-000000000001");
      }
      if (projectSelect) {
        setSelectValue(projectSelect, "00000000-0000-4000-8000-000000000002");
      }
    });

    await act(async () => {
      relinkButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(vi.mocked(relinkAdminTranscript)).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002"
    );
    expect(container.querySelector("[data-testid='admin-transcript-relink-success']")).not.toBeNull();
  });

  it("supports manual UUID fallback relink", async () => {
    const projects: AdminProject[] = [];
    vi.mocked(relinkAdminTranscript).mockResolvedValue({
      transcript_id: "00000000-0000-4000-8000-000000000011",
      project_id: "00000000-0000-4000-8000-000000000022",
      link_source: "admin_manual",
      updated_at: "2026-03-02T00:00:00.000Z",
    });

    await act(async () => {
      root.render(
        createElement(TranscriptLinkEditor, {
          projects,
          defaultProjectId: "",
        })
      );
    });

    const transcriptInput = container.querySelector(
      "[data-testid='admin-transcript-relink-transcript-id']"
    ) as HTMLInputElement | null;
    const projectInput = container.querySelector(
      "[data-testid='admin-transcript-relink-project-id']"
    ) as HTMLInputElement | null;
    const submitButton = container.querySelector(
      "[data-testid='admin-transcript-relink-manual-submit']"
    ) as HTMLButtonElement | null;

    await act(async () => {
      if (transcriptInput) {
        setInputValue(transcriptInput, "00000000-0000-4000-8000-000000000011");
      }
      if (projectInput) {
        setInputValue(projectInput, "00000000-0000-4000-8000-000000000022");
      }
    });

    await act(async () => {
      submitButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(vi.mocked(relinkAdminTranscript)).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000022"
    );
  });
});
