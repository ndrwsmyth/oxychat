"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAdminDocuments, deleteAdminDocument, type AdminDocument } from "@/lib/api";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface DocumentListProps {
  projectId: string;
  refreshKey: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentList({ projectId, refreshKey }: DocumentListProps) {
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- Loading data from async fetch in effect */
    setIsLoading(true);

    fetchAdminDocuments(projectId)
      .then((docs) => {
        if (!cancelled) setDocuments(docs);
      })
      .catch(() => {
        if (!cancelled) setDocuments([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    /* eslint-enable react-hooks/set-state-in-effect */

    return () => {
      cancelled = true;
    };
  }, [projectId, refreshKey]);

  const handleDelete = useCallback(async (doc: AdminDocument) => {
    try {
      await deleteAdminDocument(doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success(`Deleted "${doc.title}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }, []);

  if (isLoading) {
    return <p className="oxy-admin-muted" role="status">Loading documents…</p>;
  }

  if (documents.length === 0) {
    return <p className="oxy-admin-muted">No documents in this project.</p>;
  }

  return (
    <div className="oxy-admin-list" data-testid="admin-document-list">
      {documents.map((doc) => (
        <div key={doc.id} className="oxy-admin-list-item">
          <div className="oxy-admin-list-item-content">
            <span className="oxy-admin-list-item-title">{doc.title}</span>
            <span className="oxy-admin-list-item-meta">
              {formatBytes(doc.size_bytes)} · {doc.visibility_scope}
            </span>
          </div>
          <button
            type="button"
            className="oxy-admin-icon-btn"
            onClick={() => void handleDelete(doc)}
            aria-label={`Delete ${doc.title}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
