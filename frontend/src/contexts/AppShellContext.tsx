"use client";

import { createContext, useContext } from "react";
import type { Conversation, GroupedConversations, WorkspaceTreeClient } from "@/types";

export interface AppShellContextType {
  conversationId: string | null;
  selectedProjectId: string | null;
  isAdmin: boolean;
  workspaceClients: WorkspaceTreeClient[];
  conversations: GroupedConversations;
  createConversation: (
    title?: string,
    model?: string,
    scopedProjectId?: string | null
  ) => Promise<Conversation>;
  updateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => void;
  deleteConversation: (id: string) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
}

const AppShellContext = createContext<AppShellContextType | null>(null);

export function AppShellProvider({
  value,
  children,
}: {
  value: AppShellContextType;
  children: React.ReactNode;
}) {
  return (
    <AppShellContext.Provider value={value}>
      {children}
    </AppShellContext.Provider>
  );
}

export function useAppShell(): AppShellContextType {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within an AppShellProvider");
  }
  return ctx;
}
