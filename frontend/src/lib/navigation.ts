import type { WorkspaceTreeClient } from "@/types";

interface HomeUrlParams {
  conversationId?: string | null;
  projectId?: string | null;
}

export function buildHomeUrl({ conversationId, projectId }: HomeUrlParams): string {
  const params = new URLSearchParams();
  if (conversationId) params.set("c", conversationId);
  if (projectId) params.set("project", projectId);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function getVisibleWorkspaceProjectIds(clients: WorkspaceTreeClient[]): Set<string> {
  const projectIds = new Set<string>();
  for (const client of clients) {
    for (const project of client.projects) {
      projectIds.add(project.id);
    }
  }
  return projectIds;
}

export function isProjectVisible(projectId: string, clients: WorkspaceTreeClient[]): boolean {
  return getVisibleWorkspaceProjectIds(clients).has(projectId);
}
