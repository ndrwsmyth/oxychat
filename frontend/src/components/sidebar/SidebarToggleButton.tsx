"use client";

import { PanelLeftOpen } from "lucide-react";
import { useSidebar } from "@/hooks/useSidebar";

export function SidebarToggleButton() {
  const { collapsed, toggle } = useSidebar();

  if (!collapsed) return null;

  return (
    <button
      className="oxy-sidebar-floating-toggle"
      onClick={toggle}
      aria-label="Open sidebar"
      title="Open sidebar (Cmd+B)"
    >
      <PanelLeftOpen size={20} />
    </button>
  );
}
