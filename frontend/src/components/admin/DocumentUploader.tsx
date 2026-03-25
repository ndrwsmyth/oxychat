"use client";

import { useCallback, useRef, useState } from "react";
import { uploadAdminDocument } from "@/lib/api";
import { toast } from "sonner";

interface DocumentUploaderProps {
  projectId: string;
  onUploaded: () => void;
}

type UploadState = "idle" | "dragging" | "uploading" | "success" | "error";

export function DocumentUploader({ projectId, onUploaded }: DocumentUploaderProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!projectId) {
        toast.error("Select a project first");
        return;
      }

      if (!file.name.endsWith(".md") && file.type !== "text/markdown") {
        toast.error("Only .md (markdown) files are supported");
        return;
      }

      setUploadState("uploading");
      setErrorMessage(null);

      try {
        const content = await file.text();
        const title = file.name.replace(/\.md$/, "");

        await uploadAdminDocument({
          project_id: projectId,
          title,
          content,
        });

        setUploadState("success");
        toast.success(`Uploaded "${title}"`);
        onUploaded();
        setTimeout(() => setUploadState("idle"), 2000);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setErrorMessage(message);
        setUploadState("error");
        toast.error(message);
      }
    },
    [projectId, onUploaded]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState("dragging");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState("idle");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setUploadState("idle");
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
      e.target.value = "";
    },
    [processFile]
  );

  return (
    <div data-testid="admin-document-uploader">
      <div
        className={`oxy-admin-dropzone ${uploadState === "dragging" ? "oxy-admin-dropzone-active" : ""} ${uploadState === "uploading" ? "oxy-admin-dropzone-uploading" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Drop markdown file here or click to browse"
        data-testid="admin-doc-dropzone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,text/markdown"
          onChange={handleFileSelect}
          className="oxy-admin-file-input-hidden"
          tabIndex={-1}
        />
        {uploadState === "uploading" ? (
          <p role="status" className="oxy-admin-muted">Uploading…</p>
        ) : uploadState === "success" ? (
          <p className="oxy-admin-muted">Upload complete</p>
        ) : (
          <p className="oxy-admin-muted">
            Drop a .md file here, or click to browse
          </p>
        )}
      </div>

      {errorMessage ? (
        <p role="alert" data-testid="admin-doc-upload-error" className="oxy-admin-error oxy-admin-mt-sm">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
