import { describe, expect, it } from "vitest";
import { buildHomeUrl, getVisibleWorkspaceProjectIds, isProjectVisible } from "@/lib/navigation";
import type { WorkspaceTreeClient } from "@/types";

const fixtureClients: WorkspaceTreeClient[] = [
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
  {
    id: "client-2",
    name: "Global",
    scope: "global",
    projects: [
      {
        id: "project-2",
        name: "Global Inbox",
        scope: "global",
        client_id: "client-2",
        conversation_count: 1,
      },
    ],
  },
];

describe("navigation utilities", () => {
  it("builds canonical URL with project-only context", () => {
    expect(buildHomeUrl({ projectId: "project-1" })).toBe("/?project=project-1");
  });

  it("builds canonical URL with conversation + project context", () => {
    expect(buildHomeUrl({ conversationId: "conv-1", projectId: "project-1" })).toBe(
      "/?c=conv-1&project=project-1"
    );
  });

  it("returns root URL when no context is selected", () => {
    expect(buildHomeUrl({})).toBe("/");
  });

  it("derives visible workspace project ids", () => {
    const projectIds = getVisibleWorkspaceProjectIds(fixtureClients);
    expect(Array.from(projectIds).sort()).toEqual(["project-1", "project-2"]);
  });

  it("guards unauthorized project selection via workspace visibility", () => {
    expect(isProjectVisible("project-1", fixtureClients)).toBe(true);
    expect(isProjectVisible("project-unknown", fixtureClients)).toBe(false);
  });
});
