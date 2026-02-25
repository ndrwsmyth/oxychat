"use client";

import { useCallback, useMemo, useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranscripts } from "@/hooks/useTranscripts";
import { useConversation } from "@/hooks/useConversation";
import { getDraft, saveDraft, clearDraft, cleanupDrafts, type DraftData, type MentionChip } from "@/hooks/useDrafts";
import { useSearch } from "@/hooks/useSearch";
import { useConversations } from "@/hooks/useConversations";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAuthSetup } from "@/hooks/useAuthSetup";
import { SidebarProvider } from "@/hooks/useSidebar";
import { TranscriptsPanelProvider } from "@/hooks/useTranscriptsPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationSidebar } from "@/components/sidebar/ConversationSidebar";
import { TranscriptsPanel } from "@/components/library/TranscriptsPanel";
import { SearchModal } from "@/components/search/SearchModal";
import { OxyHeader } from "@/components/OxyHeader";
import { OxyEmptyState } from "@/components/chat/OxyEmptyState";
import { OxyMessageThread } from "@/components/chat/OxyMessageThread";
import { OxyComposer } from "@/components/chat/OxyComposer";
import { buildHomeUrl, isProjectVisible } from "@/lib/navigation";
import type { Conversation, WorkspaceTreeClient } from "@/types";

function findSelectedProjectContext(
  selectedProjectId: string | null,
  workspaceClients: WorkspaceTreeClient[]
) {
  if (!selectedProjectId) return null;
  for (const client of workspaceClients) {
    const project = client.projects.find((item) => item.id === selectedProjectId);
    if (project) {
      return {
        clientName: client.name,
        projectName: project.name,
      };
    }
  }
  return null;
}

export function HomeContent() {
  // Wire up Clerk auth to API client
  useAuthSetup();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");
  const selectedProjectId = searchParams.get("project")?.trim() || null;
  const debugSidebar = process.env.NODE_ENV !== "production" && searchParams.get("debugSidebar") === "1";

  const { transcripts, isLoading: transcriptsLoading, reload: reloadTranscripts } = useTranscripts();
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

  const handleTitleUpdate = useCallback((title: string, convId: string) => {
    updateConversationTitle(convId, title);
  }, [updateConversationTitle]);

  const {
    messages,
    conversationProjectId,
    model,
    modelOptions,
    isModelsReady,
    isLoading,
    isStreaming,
    isThinking,
    error,
    sendMessage,
    stopGenerating,
    changeModel,
  } =
    useConversation(conversationId, { onTitleUpdate: handleTitleUpdate });

  // Draft persistence state - initialized from localStorage based on current conversation
  const initialDraft = getDraft(conversationId);
  const [mentions, setMentions] = useState<MentionChip[]>(initialDraft?.mentions ?? []);
  const [draftText, setDraftText] = useState(initialDraft?.text ?? "");
  const [draftToRestore, setDraftToRestore] = useState<DraftData | null>(initialDraft);
  const draftTextRef = useRef(initialDraft?.text ?? "");
  const mentionsRef = useRef<MentionChip[]>(initialDraft?.mentions ?? []);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevConversationIdRef = useRef<string | null>(conversationId);

  // Clean up expired drafts on mount
  useEffect(() => {
    cleanupDrafts();
  }, []);

  // Load draft when conversation changes
  // This synchronizes React state with localStorage (external state) on navigation
  useEffect(() => {
    if (prevConversationIdRef.current === conversationId) return;
    prevConversationIdRef.current = conversationId;

    const draft = getDraft(conversationId);
    /* eslint-disable react-hooks/set-state-in-effect -- Synchronizing with external localStorage state on navigation */
    setDraftToRestore(draft);
    setDraftText(draft?.text ?? "");
    setMentions(draft?.mentions ?? []);
    draftTextRef.current = draft?.text ?? "";
    mentionsRef.current = draft?.mentions ?? [];
    /* eslint-enable react-hooks/set-state-in-effect */
    if (draft?.model && draft.model !== model) {
      changeModel(draft.model);
    }
  }, [conversationId, model, changeModel]);

  // Debounced save of draft
  const handleDraftChange = useCallback((text: string, newMentions: MentionChip[]) => {
    draftTextRef.current = text;
    mentionsRef.current = newMentions;
    setDraftText(text);
    setMentions(newMentions);

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(() => {
      if (text.trim() || newMentions.length > 0) {
        if (model) {
          saveDraft(conversationId, { text, mentions: newMentions, model });
        }
      } else {
        clearDraft(conversationId);
      }
    }, 500);
  }, [conversationId, model, setDraftText, setMentions]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Handle draft restoration complete
  const handleDraftRestored = useCallback(() => {
    setDraftToRestore(null);
  }, [setDraftToRestore]);

  const conversationsById = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const group of Object.values(conversations)) {
      for (const conversation of group) {
        map.set(conversation.id, conversation);
      }
    }
    return map;
  }, [conversations]);

  const selectedProjectContext = findSelectedProjectContext(selectedProjectId, workspaceClients);

  const pushUrl = useCallback((nextUrl: string) => {
    router.push(nextUrl, { scroll: false });
  }, [router]);

  const handleNewChat = useCallback(() => {
    clearDraft(null);
    draftTextRef.current = "";
    mentionsRef.current = [];
    setDraftText("");
    setMentions([]);
    setDraftToRestore(null);
    prevConversationIdRef.current = null;
    pushUrl(buildHomeUrl({ projectId: selectedProjectId }));
  }, [pushUrl, selectedProjectId, setDraftText, setMentions, setDraftToRestore]);

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

  // Canonicalize URL when conversation-scoped project differs from query state.
  useEffect(() => {
    if (!conversationId || !conversationProjectId) return;
    if (selectedProjectId === conversationProjectId) return;
    router.replace(
      buildHomeUrl({
        conversationId,
        projectId: conversationProjectId,
      }),
      { scroll: false }
    );
  }, [conversationId, conversationProjectId, router, selectedProjectId]);

  // useSearch hook with conversations for local-first filtering
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

  const send = useCallback(async (content: string, passedMentions: MentionChip[]) => {
    const currentDraft = content.trim();
    if (!currentDraft || isStreaming || !isModelsReady || !model) return;

    let targetConversationId = conversationId;

    // Create conversation on first message if needed
    if (!targetConversationId) {
      try {
        const newConv = await createConversation(undefined, model, selectedProjectId);
        targetConversationId = newConv.id;
        // Clear the "new" draft since we're creating a conversation
        clearDraft(null);
        prevConversationIdRef.current = targetConversationId;
        pushUrl(
          buildHomeUrl({
            conversationId: targetConversationId,
            projectId: newConv.project_id,
          })
        );
      } catch {
        toast.error("Failed to start conversation", {
          description: "Please try again.",
        });
        return;
      }
    } else {
      // Clear the draft for this conversation
      clearDraft(targetConversationId);
    }

    const mentionIds = passedMentions.map(m => m.id);

    // Clear input immediately before streaming starts
    draftTextRef.current = "";
    mentionsRef.current = [];
    setDraftText("");
    setMentions([]);

    await sendMessage(currentDraft, targetConversationId ?? undefined, mentionIds);
  }, [
    isStreaming,
    isModelsReady,
    model,
    sendMessage,
    conversationId,
    createConversation,
    selectedProjectId,
    pushUrl,
    setDraftText,
    setMentions,
  ]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, [setSearchOpen]);

  // Keyboard shortcut: Shift+Cmd+O for new chat
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleNewChat();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewChat]);

  return (
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
            <TranscriptsPanel
              transcripts={transcripts}
              isLoading={transcriptsLoading}
              onRefresh={reloadTranscripts}
            />
          }
          main={
            <main className="oxy-main">
              <OxyHeader
                showHomeButton={Boolean(conversationId || selectedProjectId)}
                breadcrumb={selectedProjectContext}
              />

              {/* Content area */}
              {messages.length === 0 ? (
                <div className="oxy-content">
                  <OxyEmptyState selectedProjectName={selectedProjectContext?.projectName ?? null} />
                </div>
              ) : (
                <OxyMessageThread
                  messages={messages}
                  isLoading={isLoading}
                  isThinking={isThinking}
                />
              )}

              {/* Error message */}
              {error && (
                <div className="oxy-error">
                  <p>{error}</p>
                  <button onClick={() => window.location.reload()}>
                    Retry
                  </button>
                </div>
              )}

              {/* Composer */}
              <OxyComposer
                value={draftText}
                onChange={(text) => handleDraftChange(text, mentionsRef.current)}
                mentions={mentions}
                onMentionsChange={(newMentions) => handleDraftChange(draftTextRef.current, newMentions)}
                onSend={send}
                onStop={stopGenerating}
                onNewConversation={handleNewChat}
                disabled={isStreaming || !isModelsReady || !model}
                isGenerating={isStreaming}
                hasMessages={messages.length > 0}
                transcripts={transcripts}
                model={model}
                modelOptions={modelOptions}
                onModelChange={changeModel}
                draftToRestore={draftToRestore}
                onDraftRestored={handleDraftRestored}
              />
            </main>
          }
        />
      </TranscriptsPanelProvider>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
