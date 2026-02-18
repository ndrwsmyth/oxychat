"use client";

import { useCallback, useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranscripts } from "@/hooks/useTranscripts";
import { useConversation } from "@/hooks/useConversation";
import { getDraft, saveDraft, clearDraft, cleanupDrafts, type DraftData, type MentionChip } from "@/hooks/useDrafts";
import { useSearch } from "@/hooks/useSearch";
import { useConversations } from "@/hooks/useConversations";
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

function HomeContent() {
  // Wire up Clerk auth to API client
  useAuthSetup();
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  const { transcripts, isLoading: transcriptsLoading, reload: reloadTranscripts } = useTranscripts();
  const {
    conversations,
    isLoading: conversationsLoading,
    createConversation,
    updateConversation,
    updateConversationTitle,
    deleteConversation,
    togglePin,
  } = useConversations();

  const handleTitleUpdate = useCallback((title: string, convId: string) => {
    updateConversationTitle(convId, title);
  }, [updateConversationTitle]);

  const { messages, model, isLoading, isStreaming, isThinking, error, sendMessage, stopGenerating, changeModel } =
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
        saveDraft(conversationId, { text, mentions: newMentions, model });
      } else {
        clearDraft(conversationId);
      }
    }, 500);
  }, [conversationId, model]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Handle draft restoration complete
  const handleDraftRestored = useCallback(() => {
    setDraftToRestore(null);
  }, []);

  const handleNewChat = useCallback(() => {
    clearDraft(null);
    draftTextRef.current = "";
    mentionsRef.current = [];
    setDraftText("");
    setMentions([]);
    setDraftToRestore(null);
    prevConversationIdRef.current = null;
    router.push("/");
  }, [router]);

  const handleSelectConversation = useCallback((id: string) => {
    router.push(`/?c=${id}`);
  }, [router]);

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
    if (!currentDraft || isStreaming) return;

    let targetConversationId = conversationId;

    // Create conversation on first message if needed
    if (!targetConversationId) {
      try {
        const newConv = await createConversation();
        targetConversationId = newConv.id;
        // Clear the "new" draft since we're creating a conversation
        clearDraft(null);
        prevConversationIdRef.current = targetConversationId;
        router.push(`/?c=${targetConversationId}`, { scroll: false });
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
  }, [isStreaming, sendMessage, conversationId, createConversation, router]);

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
              onOpenSearch={handleOpenSearch}
              conversations={conversations}
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
              <OxyHeader showHomeButton={!!conversationId} />

              {/* Content area */}
              {messages.length === 0 ? (
                <div className="oxy-content">
                  <OxyEmptyState />
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
                disabled={isStreaming}
                isGenerating={isStreaming}
                hasMessages={messages.length > 0}
                transcripts={transcripts}
                model={model}
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
