"use client";

import { ReactNode } from "react";
import { useSidebar } from "@/hooks/useSidebar";
import { useTranscriptsPanel } from "@/hooks/useTranscriptsPanel";

interface AppLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  rightPanel?: ReactNode;
}

export function AppLayout({ sidebar, main, rightPanel }: AppLayoutProps) {
  const { collapsed, setCollapsed } = useSidebar();
  const { open: panelOpen } = useTranscriptsPanel();

  return (
    <div
      className="oxy-app-layout"
      style={{
        "--sidebar-width": collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width-expanded)",
        "--panel-width": panelOpen ? "var(--panel-width-default)" : "0px",
      } as React.CSSProperties}
    >
      {/* Mobile backdrop - only visible on mobile when sidebar is open */}
      {!collapsed && (
        <div
          className="oxy-mobile-backdrop"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar */}
      <aside className="oxy-sidebar" data-collapsed={collapsed}>
        {sidebar}
      </aside>

      {/* Main Content Area */}
      <main className="oxy-main-content">
        <div className="oxy-chat-container">
          {main}
        </div>
      </main>

      {/* Right Panel (Transcripts) */}
      <aside className="oxy-right-panel" data-open={panelOpen}>
        {rightPanel}
      </aside>
    </div>
  );
}
