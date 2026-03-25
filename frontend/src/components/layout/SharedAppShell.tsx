"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranscripts } from "@/hooks/useTranscripts";
import { useSearch } from "@/hooks/useSearch";
import { useConversations } from "@/hooks/useConversations";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAuthSetup } from "@/hooks/useAuthSetup";
import { useAdminSession } from "@/hooks/useAdminSession";
import { SidebarProvider } from "@/hooks/useSidebar";
import { TranscriptsPanelProvider } from "@/hooks/useTranscriptsPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationSidebar } from "@/components/sidebar/ConversationSidebar";
import { TranscriptsPanel } from "@/components/library/TranscriptsPanel";
import { SearchModal } from "@/components/search/SearchModal";
import { AppShellProvider } from "@/contexts/AppShellContext";
import { buildHomeUrl, isProjectVisible } from "@/lib/navigation";
import type { Conversation } from "@/types";

export function SharedAppShell({ children }: { children: React.ReactNode }) {
  useAuthSetup();
  const { isAdmin } = useAdminSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isOnAdmin = pathname === "/admin" || pathname?.startsWith("/admin/");

  const conversationId = searchParams.get("c");
  const selectedProjectId = searchParams.get("project")?.trim() || null;
  const debugSidebar = process.env.NODE_ENV !== "production" && searchParams.get("debugSidebar") === "1";

  const { transcripts, isLoading: transcriptsLoading, reload: reloadTranscripts } = useTranscripts({
    projectId: selectedProjectId,
  });
  const { clients: workspaceClients, isLoading: workspacesLoading } = useWorkspaces();
  const {
    conversations,
    isLoading: conversationsLoading,
    createConversation,
    updateConversation,
    updateConversationTitle,
    deleteConversation,
    togglePin,
  } = useConversations({ projectId: selectedProjectId });

  const conversationsById = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const group of Object.values(conversations)) {
      for (const conversation of group) {
        map.set(conversation.id, conversation);
      }
    }
    return map;
  }, [conversations]);

  const pushUrl = useCallback((nextUrl: string) => {
    router.push(nextUrl, { scroll: false });
  }, [router]);

  const handleNewChat = useCallback(() => {
    pushUrl(buildHomeUrl({ projectId: selectedProjectId }));
  }, [pushUrl, selectedProjectId]);

  const handleSelectConversation = useCallback((id: string) => {
    const conversation = conversationsById.get(id);
    pushUrl(
      buildHomeUrl({
        conversationId: id,
        projectId: conversation?.project_id ?? selectedProjectId,
      })
    );
  }, [conversationsById, pushUrl, selectedProjectId]);

  const handleSelectProject = useCallback((projectId: string | null) => {
    pushUrl(buildHomeUrl({ projectId }));
  }, [pushUrl]);

  // URL guard: drop unauthorized project selection when no conversation is active.
  useEffect(() => {
    if (workspacesLoading || !selectedProjectId || conversationId) return;
    if (!isProjectVisible(selectedProjectId, workspaceClients)) {
      router.replace(buildHomeUrl({}), { scroll: false });
    }
  }, [conversationId, router, selectedProjectId, workspaceClients, workspacesLoading]);

  // Keyboard shortcut: Shift+Cmd+O for new chat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        handleNewChat();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewChat]);

  const {
    isOpen: isSearchOpen,
    setIsOpen: setSearchOpen,
    query: searchQuery,
    setQuery: setSearchQuery,
    localResults,
    isSearchingDeeper,
    selectedIndex,
    setSelectedIndex,
  } = useSearch({
    conversations,
    onSelectConversation: handleSelectConversation,
    onNewChat: handleNewChat,
  });

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, [setSearchOpen]);

  const contextValue = useMemo(
    () => ({
      conversationId,
      selectedProjectId,
      isAdmin,
      workspaceClients,
      conversations,
      createConversation,
      updateConversation,
      updateConversationTitle,
      deleteConversation,
      togglePin,
    }),
    [
      conversationId,
      selectedProjectId,
      isAdmin,
      workspaceClients,
      conversations,
      createConversation,
      updateConversation,
      updateConversationTitle,
      deleteConversation,
      togglePin,
    ]
  );

  return (
    <AppShellProvider value={contextValue}>
      <SidebarProvider>
        <TranscriptsPanelProvider>
          {/* Ambient light gradient */}
          <div className="oxy-ambient" />

          {/* Search modal */}
          <SearchModal
            isOpen={isSearchOpen}
            onClose={() => setSearchOpen(false)}
            onNewChat={handleNewChat}
            query={searchQuery}
            setQuery={setSearchQuery}
            localResults={localResults}
            isSearchingDeeper={isSearchingDeeper}
            selectedIndex={selectedIndex}
            setSelectedIndex={setSelectedIndex}
          />

          {/* Main layout with sidebar and right panel */}
          <AppLayout
            sidebar={
              <ConversationSidebar
                activeConversationId={conversationId}
                selectedProjectId={selectedProjectId}
                showAdminEntry={isAdmin}
                debugLayout={debugSidebar}
                onOpenSearch={handleOpenSearch}
                conversations={conversations}
                workspaceClients={workspaceClients}
                workspacesLoading={workspacesLoading}
                onSelectProject={handleSelectProject}
                isLoading={conversationsLoading}
                onNewChat={handleNewChat}
                onUpdateConversation={updateConversation}
                onDeleteConversation={deleteConversation}
                onTogglePin={togglePin}
              />
            }
            rightPanel={
              !isOnAdmin ? (
                <TranscriptsPanel
                  transcripts={transcripts}
                  isLoading={transcriptsLoading}
                  onRefresh={reloadTranscripts}
                />
              ) : undefined
            }
            main={children}
          />
        </TranscriptsPanelProvider>
      </SidebarProvider>
    </AppShellProvider>
  );
}
