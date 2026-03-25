"use client";

import { useMemo, useState } from "react";
import { useAdminTranscriptRelink } from "@/hooks/useAdminTranscriptRelink";
import { searchAdminTranscripts, type AdminProject, type TranscriptResponse } from "@/lib/api";
import { toAdminErrorDisplayMessage } from "@/lib/admin-errors";

interface TranscriptLinkEditorProps {
  projects: AdminProject[];
  defaultProjectId: string;
}

export function TranscriptLinkEditor({ projects, defaultProjectId }: TranscriptLinkEditorProps) {
  const { relink, isLoading, error, lastResult } = useAdminTranscriptRelink();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TranscriptResponse[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTranscriptId, setSelectedTranscriptId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId);
  const [manualTranscriptId, setManualTranscriptId] = useState("");
  const [manualProjectId, setManualProjectId] = useState("");
  const [uiError, setUiError] = useState<string | null>(null);

  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const effectiveProjectId =
    selectedProjectId ||
    defaultProjectId ||
    sortedProjects[0]?.id ||
    "";

  async function handleSearch() {
    const nextQuery = searchQuery.trim();
    if (!nextQuery) {
      setSearchResults([]);
      setSearchError(null);
      setSelectedTranscriptId("");
      return;
    }

    try {
      const rows = await searchAdminTranscripts(nextQuery);
      setSearchResults(rows);
      setSearchError(null);
      setSelectedTranscriptId((prev) => (prev ? prev : rows[0]?.id ?? ""));
    } catch (err) {
      setSearchResults([]);
      setSelectedTranscriptId("");
      setSearchError(err instanceof Error ? err.message : "Failed to search transcripts");
    }
  }

  async function handleRelinkSelected() {
    if (!selectedTranscriptId || !effectiveProjectId) {
      return;
    }

    try {
      setUiError(null);
      await relink(selectedTranscriptId, effectiveProjectId);
    } catch (err) {
      setUiError(toAdminErrorDisplayMessage(err, "Failed to relink transcript"));
    }
  }

  async function handleManualRelink() {
    if (!manualTranscriptId.trim() || !manualProjectId.trim()) {
      return;
    }

    try {
      setUiError(null);
      await relink(manualTranscriptId.trim(), manualProjectId.trim());
    } catch (err) {
      setUiError(toAdminErrorDisplayMessage(err, "Failed to relink transcript"));
    }
  }

  return (
    <section data-testid="admin-transcript-link-editor" className="oxy-admin-card">
      <h2 className="oxy-admin-card-title">Transcript Relink</h2>
      <p className="oxy-admin-card-subtitle">
        Search transcripts, select a project, and apply admin manual relinks.
      </p>

      <div className="oxy-admin-form-stack oxy-admin-mt-base">
        <div className="oxy-admin-form-row">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search transcripts by title"
            data-testid="admin-transcript-search-query"
            className="oxy-admin-input oxy-admin-input-bordered"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={isLoading}
            className="oxy-admin-btn"
            data-testid="admin-transcript-search-submit"
          >
            Search
          </button>
        </div>

        {searchError ? (
          <p role="alert" data-testid="admin-transcript-search-error" className="oxy-admin-error">
            {searchError}
          </p>
        ) : null}

        <label htmlFor="admin-transcript-match-select" className="oxy-admin-label">Matched transcript</label>
        <select
          id="admin-transcript-match-select"
          value={selectedTranscriptId}
          onChange={(event) => setSelectedTranscriptId(event.target.value)}
          data-testid="admin-transcript-match-select"
          className="oxy-admin-select"
          disabled={searchResults.length === 0}
        >
          {searchResults.length === 0 ? <option value="">No transcript selected</option> : null}
          {searchResults.map((transcript) => (
            <option key={transcript.id} value={transcript.id}>
              {transcript.title} ({new Date(transcript.date).toLocaleDateString()})
            </option>
          ))}
        </select>

        <label htmlFor="admin-transcript-project-select" className="oxy-admin-label">Project</label>
        <select
          id="admin-transcript-project-select"
          value={effectiveProjectId}
          onChange={(event) => setSelectedProjectId(event.target.value)}
          data-testid="admin-transcript-project-select"
          className="oxy-admin-select"
          disabled={sortedProjects.length === 0}
        >
          {sortedProjects.length === 0 ? <option value="">No projects</option> : null}
          {sortedProjects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void handleRelinkSelected()}
          disabled={isLoading || !selectedTranscriptId || !effectiveProjectId}
          data-testid="admin-transcript-relink-submit"
          className="oxy-admin-btn oxy-admin-btn-primary"
        >
          Relink selected transcript
        </button>
      </div>

      <details className="oxy-admin-collapsible oxy-admin-mt-base">
        <summary>Advanced: manual UUID relink</summary>
        <div className="oxy-admin-form-row oxy-admin-mt-sm">
          <input
            value={manualTranscriptId}
            onChange={(event) => setManualTranscriptId(event.target.value)}
            placeholder="transcript_id (UUID)"
            data-testid="admin-transcript-relink-transcript-id"
            className="oxy-admin-input"
          />
          <input
            value={manualProjectId}
            onChange={(event) => setManualProjectId(event.target.value)}
            placeholder="project_id (UUID)"
            data-testid="admin-transcript-relink-project-id"
            className="oxy-admin-input"
          />
          <button
            type="button"
            onClick={() => void handleManualRelink()}
            disabled={isLoading}
            data-testid="admin-transcript-relink-manual-submit"
            className="oxy-admin-btn"
          >
            Relink by ID
          </button>
        </div>
      </details>

      {uiError ? (
        <p role="alert" data-testid="admin-transcript-relink-ui-error" className="oxy-admin-error oxy-admin-mt-sm">
          {uiError}
        </p>
      ) : null}

      {error ? (
        <p role="alert" data-testid="admin-transcript-relink-error" className="oxy-admin-error oxy-admin-mt-sm">
          {error}
        </p>
      ) : null}

      {!uiError && !error ? (
        <p className="oxy-admin-status oxy-admin-mt-sm">
          Private and unclassified transcripts remain fail-closed by policy.
        </p>
      ) : null}

      {lastResult ? (
        <p data-testid="admin-transcript-relink-success" className="oxy-admin-status oxy-admin-mt-sm">
          Relinked {lastResult.transcript_id} to {lastResult.project_id} via {lastResult.link_source}.
        </p>
      ) : null}
    </section>
  );
}
