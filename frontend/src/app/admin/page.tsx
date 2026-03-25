"use client";

import { useMemo, useRef, useState } from "react";
import { ProjectsTableEditor } from "@/components/admin/ProjectsTableEditor";
import { TranscriptLinkEditor } from "@/components/admin/TranscriptLinkEditor";
import { ProjectOverviewEditor } from "@/components/admin/ProjectOverviewEditor";
import { AdminAuditTimeline } from "@/components/admin/AdminAuditTimeline";
import { useAdminConsoleData } from "@/hooks/useAdminConsoleData";
import { toAdminErrorDisplayMessage } from "@/lib/admin-errors";

type AdminTab = "projects" | "relink" | "audit";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("projects");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const {
    clients,
    projects,
    isLoading,
    isMutating,
    error,
    createProject,
    updateProject,
    removeProject,
  } = useAdminConsoleData();

  const overviewRef = useRef<HTMLDivElement>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const effectiveSelectedProjectId =
    sortedProjects.find((project) => project.id === selectedProjectId)?.id ??
    sortedProjects[0]?.id ??
    "";

  return (
    <div className="oxy-admin-container" data-testid="admin-shell">
      <p className="oxy-admin-breadcrumb">Settings</p>
      <h1 className="oxy-admin-page-title">Admin Console</h1>
      <p className="oxy-admin-page-desc">Manage projects, routing, and audit review.</p>

      {error ? (
        <p role="alert" data-testid="admin-page-error" className="oxy-admin-error oxy-admin-mt-base">
          {toAdminErrorDisplayMessage(new Error(error), error)}
        </p>
      ) : null}

      <nav aria-label="Admin sections" className="oxy-admin-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          aria-pressed={activeTab === "projects"}
          data-testid="admin-tab-projects"
          className="oxy-admin-tab"
        >
          Projects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("relink")}
          aria-pressed={activeTab === "relink"}
          data-testid="admin-tab-relink"
          className="oxy-admin-tab"
        >
          Transcript Relink
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          aria-pressed={activeTab === "audit"}
          data-testid="admin-tab-audit"
          className="oxy-admin-tab"
        >
          Audit
        </button>
      </nav>

      {activeTab === "projects" ? (
        <div
          data-testid="admin-projects-editor"
          aria-label="Projects editor"
          className="oxy-admin-sections"
        >
          <ProjectsTableEditor
            clients={clients}
            projects={projects}
            isLoading={isLoading}
            isMutating={isMutating}
            error={error}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onDeleteProject={removeProject}
            onEditOverview={(id) => {
              setSelectedProjectId(id);
              setTimeout(() => overviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
            }}
            onRelinkTranscripts={(id) => {
              setSelectedProjectId(id);
              setActiveTab("relink");
            }}
          />
          <div ref={overviewRef}>
          <ProjectOverviewEditor
            projects={projects}
            isLoading={isLoading}
            isSaving={isMutating}
            error={error}
            selectedProjectId={effectiveSelectedProjectId}
            onSelectProject={setSelectedProjectId}
            onSaveOverview={async (projectId, overviewMarkdown) => {
              await updateProject(projectId, { overview_markdown: overviewMarkdown });
            }}
          />
          </div>
        </div>
      ) : activeTab === "relink" ? (
        <section data-testid="admin-relink-editor" aria-label="Transcript relink">
          <TranscriptLinkEditor
            projects={projects}
            defaultProjectId={effectiveSelectedProjectId}
          />
        </section>
      ) : (
        <section data-testid="admin-audit-editor" aria-label="Audit editor">
          <AdminAuditTimeline />
        </section>
      )}
    </div>
  );
}
