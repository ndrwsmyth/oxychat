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
  const { open: panelOpen, setOpen: setPanelOpen } = useTranscriptsPanel();

  return (
    <div
      className="oxy-app-layout"
      style={{
        "--sidebar-width": collapsed ? "var(--sidebar-width-collapsed)" : "var(--sidebar-width-expanded)",
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

      {/* Right Panel (Transcripts) - Fixed overlay, not part of grid */}
      {panelOpen && (
        <div
          className="oxy-panel-backdrop"
          onClick={() => setPanelOpen(false)}
          aria-hidden="true"
        />
      )}
      <aside className="oxy-right-panel-overlay" data-open={panelOpen}>
        {rightPanel}
      </aside>
    </div>
  );
}
