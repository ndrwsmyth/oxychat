"use client";

import { ReactNode } from "react";
import { useSidebar } from "@/hooks/useSidebar";
import { PersistentSidebarBar } from "@/components/sidebar/PersistentSidebarBar";

interface AppLayoutProps {
  sidebar: ReactNode;
  main: ReactNode;
  onNewChat: () => void;
  onOpenSearch: () => void;
}

export function AppLayout({ sidebar, main, onNewChat, onOpenSearch }: AppLayoutProps) {
  const { collapsed, setCollapsed } = useSidebar();

  return (
    <div className={`oxy-app-layout ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Persistent sidebar bar - always visible */}
      <PersistentSidebarBar
        isCollapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        onNewChat={onNewChat}
        onOpenSearch={onOpenSearch}
      />

      {/* Mobile backdrop */}
      {!collapsed && (
        <div
          className="oxy-sidebar-backdrop"
          onClick={() => setCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar content - slides in/out */}
      <aside className={`oxy-sidebar ${collapsed ? "collapsed" : ""}`}>
        {sidebar}
      </aside>

      {/* Main content area */}
      <div className="oxy-main-wrapper">
        {main}
      </div>
    </div>
  );
}
