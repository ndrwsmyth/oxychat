"use client";

import { useRouter } from "next/navigation";
import { PanelLeftOpen } from "lucide-react";
import { useTranscriptsPanel } from "@/hooks/useTranscriptsPanel";
import { useSidebar } from "@/hooks/useSidebar";

interface OxyHeaderProps {
  showHomeButton?: boolean;
  breadcrumb?: {
    clientName: string;
    projectName: string;
  } | null;
}

export function OxyHeader({ showHomeButton = false, breadcrumb = null }: OxyHeaderProps) {
  const router = useRouter();
  const { open: panelOpen, toggle: toggleTranscripts } = useTranscriptsPanel();
  const { collapsed, toggle: toggleSidebar } = useSidebar();

  const handleLogoClick = () => {
    if (showHomeButton) {
      router.push("/");
    }
  };

  return (
    <header className="oxy-bar">
      <div className="oxy-bar-left">
        {collapsed && (
          <button
            type="button"
            className="oxy-bar-sidebar-toggle"
            onClick={toggleSidebar}
            aria-label="Open sidebar"
            title="Open sidebar (Cmd+B)"
          >
            <PanelLeftOpen size={18} />
          </button>
        )}
        {showHomeButton ? (
          <button
            className="oxy-mark clickable"
            onClick={handleLogoClick}
            aria-label="Go to home"
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" opacity="0.15" />
            </svg>
            <span>Oxy</span>
          </button>
        ) : (
          <div className="oxy-mark">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="2" fill="currentColor" />
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1" opacity="0.15" />
            </svg>
            <span>Oxy</span>
          </div>
        )}
      </div>
      {breadcrumb && (
        <div className="oxy-breadcrumb" aria-label="Current workspace">
          <span>{breadcrumb.clientName}</span>
          <span className="oxy-breadcrumb-separator">/</span>
          <span>{breadcrumb.projectName}</span>
        </div>
      )}
      <div className="oxy-bar-actions">
        <button
          className={`oxy-bar-btn ${panelOpen ? 'oxy-bar-btn-active' : ''}`}
          onClick={toggleTranscripts}
          aria-label={panelOpen ? "Close transcripts" : "Open transcripts"}
          aria-expanded={panelOpen}
          title="Transcripts"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
