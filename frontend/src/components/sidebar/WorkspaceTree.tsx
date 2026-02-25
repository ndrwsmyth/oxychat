"use client";

import { Building2, Folder } from "lucide-react";
import type { WorkspaceTreeClient } from "@/types";

interface WorkspaceTreeProps {
  clients: WorkspaceTreeClient[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string | null) => void;
  isLoading?: boolean;
}

export function WorkspaceTree({
  clients,
  selectedProjectId,
  onSelectProject,
  isLoading = false,
}: WorkspaceTreeProps) {
  const workspaceGroups = clients.map((client) => ({
    ...client,
    flattenProjects: client.projects.length <= 1,
  }));

  return (
    <section className="oxy-workspace-tree" aria-label="Projects">
      {isLoading ? (
        <div className="oxy-workspace-loading">
          {[68, 82, 74].map((width, i) => (
            <div key={i} className="oxy-skeleton oxy-skeleton-text" style={{ width: `${width}%` }} />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <p className="oxy-workspace-empty">No projects available.</p>
      ) : (
        <div className="oxy-workspace-groups">
          {workspaceGroups.map((client) => (
            <div key={client.id} className="oxy-workspace-client">
              {!client.flattenProjects && (
                <div className="oxy-workspace-client-row">
                  <span className="oxy-workspace-row-icon">
                    <Building2 size={16} />
                  </span>
                  <span className="oxy-workspace-client-name">{client.name}</span>
                </div>
              )}
              <div className="oxy-workspace-project-list">
                {client.projects.map((project) => {
                  const isActive = selectedProjectId === project.id;
                  return (
                    <button
                      key={project.id}
                      type="button"
                      className={`oxy-workspace-project-btn ${isActive ? "active" : ""}`}
                      onClick={() => onSelectProject(isActive ? null : project.id)}
                      aria-label={`Open ${client.name} / ${project.name}`}
                    >
                      <span className="oxy-workspace-row-icon">
                        <Folder size={19} className="oxy-workspace-project-glyph" />
                      </span>
                      <span className="oxy-workspace-project-name">{project.name}</span>
                      <span className="oxy-workspace-project-count">{project.conversation_count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
