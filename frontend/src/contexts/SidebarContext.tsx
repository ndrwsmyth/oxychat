"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(true);

  // Sync persisted preference after mount to keep server/client initial render identical.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar_collapsed");
      if (stored !== null) {
        /* eslint-disable react-hooks/set-state-in-effect -- Synchronizing with external localStorage state after hydration */
        setCollapsedState(stored === "true");
        /* eslint-enable react-hooks/set-state-in-effect */
      }
    } catch {
      // localStorage might be unavailable
    }
  }, []);

  const setCollapsed = useCallback((value: boolean) => {
    setCollapsedState(value);
    try {
      localStorage.setItem("sidebar_collapsed", String(value));
    } catch {
      // localStorage might be unavailable
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(newValue));
      } catch {
        // localStorage might be unavailable
      }
      return newValue;
    });
  }, []);

  // Keyboard shortcuts: Cmd+B or Cmd+\
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "b" || e.key === "\\")) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggle]);

  return (
    <SidebarContext.Provider value={{ collapsed, setCollapsed, toggle }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return context;
}
