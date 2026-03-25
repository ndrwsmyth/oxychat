"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Search, MoreHorizontal, ChevronUp, ChevronDown, FileText, Link, Trash2, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import type { AdminClient, AdminProject } from "@/lib/api";

type SortKey = "name" | "client" | "scope" | "created_at";
type SortDir = "asc" | "desc";

interface ProjectsTableEditorProps {
  clients: AdminClient[];
  projects: AdminProject[];
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;
  onCreateProject: (input: {
    client_id: string;
    name: string;
    scope: "personal" | "client" | "global";
  }) => Promise<void>;
  onUpdateProject: (
    projectId: string,
    input: Partial<{
      name: string;
      client_id: string;
      scope: "personal" | "client" | "global";
    }>
  ) => Promise<void>;
  onDeleteProject: (projectId: string) => Promise<void>;
  onEditOverview?: (projectId: string) => void;
  onRelinkTranscripts?: (projectId: string) => void;
}

const SCOPE_OPTIONS: Array<"personal" | "client" | "global"> = ["client", "global", "personal"];

function ScopeBadge({ scope }: { scope: string }) {
  const cls =
    scope === "client"
      ? "oxy-admin-badge-blue"
      : scope === "global"
        ? "oxy-admin-badge-amber"
        : "oxy-admin-badge-gray";
  return <span className={`oxy-admin-badge ${cls}`}>{scope}</span>;
}

function SortIndicator({ dir }: { dir: SortDir }) {
  return (
    <span className="oxy-admin-sort-indicator" aria-hidden="true">
      {dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
    </span>
  );
}

export function ProjectsTableEditor({
  clients,
  projects,
  isLoading,
  isMutating,
  error,
  onCreateProject,
  onUpdateProject,
  onDeleteProject,
  onEditOverview,
  onRelinkTranscripts,
}: ProjectsTableEditorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("client");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [editingCell, setEditingCell] = useState<{ projectId: string; field: "name" | "client_id" | "scope" } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [showCreateRow, setShowCreateRow] = useState(false);
  const [newName, setNewName] = useState("");
  const [newClientId, setNewClientId] = useState("");
  const [newScope, setNewScope] = useState<"personal" | "client" | "global">("client");
  const [actionsOpenForId, setActionsOpenForId] = useState<string | null>(null);

  const editInputRef = useRef<HTMLInputElement>(null);
  const createNameRef = useRef<HTMLInputElement>(null);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );
  const clientsById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients]
  );

  const sortedFilteredProjects = useMemo(() => {
    let filtered = projects;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = projects.filter((p) => {
        const clientName = clientsById.get(p.client_id)?.name ?? "";
        return p.name.toLowerCase().includes(q) || clientName.toLowerCase().includes(q);
      });
    }
    return [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "client":
          cmp = (clientsById.get(a.client_id)?.name ?? "").localeCompare(
            clientsById.get(b.client_id)?.name ?? ""
          );
          break;
        case "scope":
          cmp = a.scope.localeCompare(b.scope);
          break;
        case "created_at":
          cmp = a.created_at.localeCompare(b.created_at);
          break;
      }
      if (cmp === 0 && sortKey !== "name") {
        cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [projects, searchQuery, sortKey, sortDir, clientsById]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function ariaSortValue(key: SortKey): "ascending" | "descending" | "none" {
    if (sortKey !== key) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  function startEdit(projectId: string, field: "name" | "client_id" | "scope", currentValue: string) {
    setEditingCell({ projectId, field });
    setEditValue(currentValue);
  }

  async function commitEdit(projectId: string, field: string, newValue: string, oldValue: string) {
    setEditingCell(null);
    if (newValue.trim() === oldValue) return;
    try {
      await onUpdateProject(projectId, { [field]: newValue.trim() });
      toast.success("Project updated");
    } catch {
      toast.error("Failed to update project");
    }
  }

  function cancelEdit() {
    setEditingCell(null);
    setEditValue("");
  }

  async function handleCreate() {
    if (!newClientId || !newName.trim()) return;
    try {
      await onCreateProject({ client_id: newClientId, name: newName.trim(), scope: newScope });
      setNewName("");
      setNewClientId("");
      setNewScope("client");
      setShowCreateRow(false);
      toast.success("Project created");
    } catch {
      toast.error("Failed to create project");
    }
  }

  async function handleConfirmDelete() {
    if (!deletingProjectId) return;
    const name = projects.find((p) => p.id === deletingProjectId)?.name;
    try {
      await onDeleteProject(deletingProjectId);
      setDeletingProjectId(null);
      toast.success(`Deleted "${name}"`);
    } catch {
      toast.error("Failed to delete project");
    }
  }

  // Auto-focus edit input
  useEffect(() => {
    if (editingCell?.field === "name") {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingCell]);

  // Auto-focus create name input
  useEffect(() => {
    if (showCreateRow) {
      createNameRef.current?.focus();
    }
  }, [showCreateRow]);

  const deletingProject = deletingProjectId ? projects.find((p) => p.id === deletingProjectId) : null;

  if (isLoading) {
    return (
      <section data-testid="projects-table-editor" className="oxy-admin-card">
        <p role="status" aria-label="Loading projects" data-testid="admin-projects-loading">
          Loading projects...
        </p>
      </section>
    );
  }

  return (
    <section data-testid="projects-table-editor" className="oxy-admin-card">
      <div className="oxy-admin-card-header">
        <div>
          <h2 className="oxy-admin-card-title">
            Projects
            <span className="oxy-admin-table-count">{projects.length}</span>
          </h2>
          <p className="oxy-admin-card-subtitle">Manage projects and their client assignments.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateRow((v) => !v)}
          className="oxy-admin-btn oxy-admin-btn-primary oxy-admin-btn-sm"
          data-testid="admin-project-new-btn"
        >
          <Plus size={14} className="oxy-admin-btn-icon-left" />
          New project
        </button>
      </div>

      {error ? (
        <p role="alert" data-testid="admin-projects-error" className="oxy-admin-error oxy-admin-mt-sm">
          {error}
        </p>
      ) : null}

      {/* Search */}
      <div className="oxy-admin-search-wrap">
        <Search size={14} className="oxy-admin-search-icon" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search projects or clients..."
          aria-label="Search projects"
          className="oxy-admin-search-input"
          data-testid="admin-projects-search"
        />
      </div>

      {/* Data table */}
      <table className="oxy-admin-data-table" role="grid">
        <thead>
          <tr>
            <th
              data-sortable="true"
              onClick={() => toggleSort("name")}
              aria-sort={ariaSortValue("name")}
              style={{ width: "40%" }}
            >
              Project {sortKey === "name" && <SortIndicator dir={sortDir} />}
            </th>
            <th
              data-sortable="true"
              onClick={() => toggleSort("client")}
              aria-sort={ariaSortValue("client")}
              style={{ width: "25%" }}
            >
              Client {sortKey === "client" && <SortIndicator dir={sortDir} />}
            </th>
            <th
              data-sortable="true"
              onClick={() => toggleSort("scope")}
              aria-sort={ariaSortValue("scope")}
              style={{ width: "15%" }}
            >
              Scope {sortKey === "scope" && <SortIndicator dir={sortDir} />}
            </th>
            <th style={{ width: "15%" }}>Created</th>
            <th style={{ width: "48px" }}></th>
          </tr>
        </thead>
        <tbody>
          {/* Inline create row */}
          {showCreateRow && (
            <tr className="oxy-admin-create-row" data-testid="admin-project-create-row">
              <td>
                <input
                  ref={createNameRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Project name"
                  className="oxy-admin-table-cell-input"
                  data-testid="admin-project-new-name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreate();
                    if (e.key === "Escape") setShowCreateRow(false);
                  }}
                />
              </td>
              <td>
                <select
                  value={newClientId}
                  onChange={(e) => setNewClientId(e.target.value)}
                  className="oxy-admin-table-cell-select"
                  data-testid="admin-project-new-client-select"
                >
                  <option value="">Select client</option>
                  {sortedClients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </td>
              <td>
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value as "personal" | "client" | "global")}
                  className="oxy-admin-table-cell-select"
                  data-testid="admin-project-new-scope"
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </td>
              <td></td>
              <td>
                <div className="oxy-admin-form-row">
                  <button
                    type="button"
                    onClick={() => void handleCreate()}
                    disabled={isMutating || !newName.trim() || !newClientId}
                    className="oxy-admin-btn-icon"
                    aria-label="Confirm create project"
                    data-testid="admin-project-create"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateRow(false)}
                    className="oxy-admin-btn-icon"
                    aria-label="Cancel create project"
                  >
                    <X size={16} />
                  </button>
                </div>
              </td>
            </tr>
          )}

          {/* Project rows */}
          {sortedFilteredProjects.map((project) => {
            const clientName = clientsById.get(project.client_id)?.name ?? project.client_id;
            const isEditingName = editingCell?.projectId === project.id && editingCell.field === "name";
            const isEditingClient = editingCell?.projectId === project.id && editingCell.field === "client_id";
            const isEditingScope = editingCell?.projectId === project.id && editingCell.field === "scope";

            return (
              <tr key={project.id} data-testid={`admin-project-row-${project.id}`}>
                {/* Name cell */}
                <td>
                  {isEditingName ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => void commitEdit(project.id, "name", editValue, project.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitEdit(project.id, "name", editValue, project.name);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="oxy-admin-table-cell-input"
                      data-testid={`admin-project-name-input-${project.id}`}
                    />
                  ) : (
                    <span
                      onClick={() => startEdit(project.id, "name", project.name)}
                      className="oxy-admin-table-cell-editable"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          startEdit(project.id, "name", project.name);
                        }
                      }}
                      data-testid={`admin-project-name-${project.id}`}
                    >
                      {project.name}
                    </span>
                  )}
                </td>

                {/* Client cell */}
                <td>
                  {isEditingClient ? (
                    <select
                      autoFocus
                      value={editValue}
                      onChange={(e) => void commitEdit(project.id, "client_id", e.target.value, project.client_id)}
                      onBlur={() => cancelEdit()}
                      onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                      className="oxy-admin-table-cell-select"
                      data-testid={`admin-project-client-select-${project.id}`}
                    >
                      {sortedClients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      onClick={() => startEdit(project.id, "client_id", project.client_id)}
                      className="oxy-admin-table-cell-editable"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          startEdit(project.id, "client_id", project.client_id);
                        }
                      }}
                      data-testid={`admin-project-client-${project.id}`}
                    >
                      {clientName}
                    </span>
                  )}
                </td>

                {/* Scope cell */}
                <td>
                  {isEditingScope ? (
                    <select
                      autoFocus
                      value={editValue}
                      onChange={(e) => void commitEdit(project.id, "scope", e.target.value, project.scope)}
                      onBlur={() => cancelEdit()}
                      onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                      className="oxy-admin-table-cell-select"
                      data-testid={`admin-project-scope-select-${project.id}`}
                    >
                      {SCOPE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <span
                      onClick={() => startEdit(project.id, "scope", project.scope)}
                      className="oxy-admin-table-cell-editable"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          startEdit(project.id, "scope", project.scope);
                        }
                      }}
                    >
                      <ScopeBadge scope={project.scope} />
                    </span>
                  )}
                </td>

                {/* Created date */}
                <td className="oxy-admin-table-cell-muted">
                  {new Date(project.created_at).toLocaleDateString()}
                </td>

                {/* Actions menu */}
                <td>
                  <Popover
                    open={actionsOpenForId === project.id}
                    onOpenChange={(open) => setActionsOpenForId(open ? project.id : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="oxy-admin-btn-icon"
                        aria-label={`Actions for ${project.name}`}
                        data-testid={`admin-project-actions-${project.id}`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="oxy-admin-actions-menu">
                      {onEditOverview && (
                        <button
                          type="button"
                          className="oxy-admin-actions-menu-item"
                          onClick={() => { setActionsOpenForId(null); onEditOverview(project.id); }}
                        >
                          <FileText size={14} /> Edit Overview
                        </button>
                      )}
                      {onRelinkTranscripts && (
                        <button
                          type="button"
                          className="oxy-admin-actions-menu-item"
                          onClick={() => { setActionsOpenForId(null); onRelinkTranscripts(project.id); }}
                        >
                          <Link size={14} /> Relink Transcripts
                        </button>
                      )}
                      <button
                        type="button"
                        className="oxy-admin-actions-menu-item oxy-admin-actions-menu-danger"
                        onClick={() => { setActionsOpenForId(null); setDeletingProjectId(project.id); }}
                        data-testid={`admin-project-delete-${project.id}`}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </PopoverContent>
                  </Popover>
                </td>
              </tr>
            );
          })}

          {/* Empty states */}
          {sortedFilteredProjects.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="oxy-admin-empty-state">
                  {searchQuery.trim() ? (
                    <>
                      <p className="oxy-admin-empty-state-title">No results</p>
                      <p className="oxy-admin-empty-state-desc">
                        No projects matching &ldquo;{searchQuery}&rdquo;.{" "}
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="oxy-admin-link-btn"
                        >
                          Clear search
                        </button>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="oxy-admin-empty-state-title">No projects yet</p>
                      <p className="oxy-admin-empty-state-desc">
                        <button
                          type="button"
                          onClick={() => setShowCreateRow(true)}
                          className="oxy-admin-link-btn"
                        >
                          Create your first project
                        </button>
                      </p>
                    </>
                  )}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingProjectId} onOpenChange={(open) => { if (!open) setDeletingProjectId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &ldquo;{deletingProject?.name}&rdquo;. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleConfirmDelete()}
              className="bg-red-600 text-white hover:bg-red-700"
              data-testid="admin-project-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
