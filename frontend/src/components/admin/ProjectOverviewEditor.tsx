"use client";

import { useMemo, useState } from "react";
import type { AdminProject } from "@/lib/api";

interface ProjectOverviewEditorProps {
  projects: AdminProject[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onSaveOverview: (projectId: string, overviewMarkdown: string | null) => Promise<void>;
}

export function ProjectOverviewEditor({
  projects,
  isLoading,
  isSaving,
  error,
  selectedProjectId,
  onSelectProject,
  onSaveOverview,
}: ProjectOverviewEditorProps) {
  const [draftsByProjectId, setDraftsByProjectId] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const selectedProject =
    sortedProjects.find((project) => project.id === selectedProjectId) ?? null;
  const overviewMarkdown = selectedProjectId
    ? draftsByProjectId[selectedProjectId] ?? selectedProject?.overview_markdown ?? ""
    : "";

  async function handleSave() {
    if (!selectedProjectId) return;
    try {
      setSaveError(null);
      const nextOverview = overviewMarkdown.trim() ? overviewMarkdown : null;
      await onSaveOverview(selectedProjectId, nextOverview);
      setDraftsByProjectId((prev) => ({
        ...prev,
        [selectedProjectId]: nextOverview ?? "",
      }));
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save overview");
    }
  }

  return (
    <section data-testid="admin-project-overview-editor" className="oxy-admin-card">
      <h2 className="oxy-admin-card-title">Project Overview</h2>
      <p className="oxy-admin-card-subtitle">Edit long-form project overview markdown using the existing project update API.</p>

      {isLoading ? <p data-testid="admin-overview-loading">Loading projects...</p> : null}
      {error ? (
        <p role="alert" data-testid="admin-overview-error" className="oxy-admin-error">
          {error}
        </p>
      ) : null}

      <div className="oxy-admin-form-stack oxy-admin-mt-base">
        <label htmlFor="admin-overview-project-select" className="oxy-admin-label">Project</label>
        <select
          id="admin-overview-project-select"
          value={selectedProjectId}
          onChange={(event) => {
            onSelectProject(event.target.value);
            setSavedAt(null);
            setSaveError(null);
          }}
          data-testid="admin-overview-project-select"
          className="oxy-admin-select oxy-admin-input-bordered"
          disabled={isLoading || sortedProjects.length === 0}
        >
          {sortedProjects.length === 0 ? <option value="">No projects</option> : null}
          {sortedProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <label htmlFor="admin-overview-markdown" className="oxy-admin-label">Overview Markdown</label>
        <textarea
          id="admin-overview-markdown"
          value={overviewMarkdown}
          onChange={(event) =>
            setDraftsByProjectId((prev) => ({
              ...prev,
              [selectedProjectId]: event.target.value,
            }))
          }
          rows={12}
          data-testid="admin-overview-markdown"
          className="oxy-admin-textarea"
          disabled={!selectedProjectId || isLoading}
        />

        <div className="oxy-admin-form-row">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!selectedProjectId || isSaving}
            data-testid="admin-overview-save"
            className="oxy-admin-btn oxy-admin-btn-primary"
          >
            Save Overview
          </button>
          {savedAt ? (
            <span data-testid="admin-overview-saved" className="oxy-admin-status">Saved at {new Date(savedAt).toLocaleTimeString()}</span>
          ) : null}
        </div>
      </div>

      {saveError ? (
        <p role="alert" data-testid="admin-overview-save-error" className="oxy-admin-error oxy-admin-mt-sm">
          {saveError}
        </p>
      ) : null}
    </section>
  );
}
