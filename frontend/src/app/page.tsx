"use client";

import { useCallback, useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranscripts } from "@/hooks/useTranscripts";
import { useConversation } from "@/hooks/useConversation";
import { useDraft } from "@/hooks/useDraft";
import { useSearch } from "@/hooks/useSearch";
import { useConversations } from "@/hooks/useConversations";
import { SidebarProvider } from "@/hooks/useSidebar";
import { TranscriptsPanelProvider } from "@/hooks/useTranscriptsPanel";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationSidebar } from "@/components/sidebar/ConversationSidebar";
import { TranscriptsPanel } from "@/components/library/TranscriptsPanel";
import { SearchModal } from "@/components/search/SearchModal";
import { OxyHeader } from "@/components/OxyHeader";
import { OxyEmptyState } from "@/components/chat/OxyEmptyState";
import { OxyMessageThread } from "@/components/chat/OxyMessageThread";
import { OxyComposer, type MentionChip } from "@/components/chat/OxyComposer";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  const { transcripts, isLoading: transcriptsLoading, reload: reloadTranscripts } = useTranscripts();
  const { conversations, createConversation, refresh: refreshConversations } = useConversations();

  // Refresh conversations list when title is auto-updated
  const handleTitleUpdate = useCallback((title: string) => {
    console.log("[Page] Title update received, refreshing conversations:", title);
    refreshConversations();
  }, [refreshConversations]);

  const { messages, model, isLoading, isThinking, error, sendMessage, stopGenerating, changeModel } =
    useConversation(conversationId, transcripts, { onTitleUpdate: handleTitleUpdate });
  const { draft, setDraft } = useDraft(conversationId);
  const [mentions, setMentions] = useState<MentionChip[]>([]);

  const handleNewChat = useCallback(async () => {
    const newConv = await createConversation("New conversation");
    router.push(`/?c=${newConv.id}`);
  }, [createConversation, router]);

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
    const currentMentions = [...passedMentions];

    console.log("[Page.send] Starting send:", {
      draft: currentDraft.substring(0, 100),
      draftLength: currentDraft.length,
      mentionCount: currentMentions.length,
      mentions: currentMentions.map(m => m.id),
      isLoading,
      conversationId,
    });

    if (!currentDraft) {
      console.warn("[Page.send] Blocked - no content passed");
      return;
    }

    if (isLoading) {
      console.warn("[Page.send] Blocked - already loading");
      return;
    }

    let targetConversationId = conversationId;

    // Create conversation on first message if needed
    if (!targetConversationId) {
      try {
        const newConv = await createConversation("New conversation");
        targetConversationId = newConv.id;
        console.log("[Page.send] Created new conversation:", targetConversationId);
        router.push(`/?c=${targetConversationId}`, { scroll: false });
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return; // Don't continue without a valid conversation
      }
    }

    // Extract mention IDs directly from the pills (not re-parsing from text)
    const mentionIds = currentMentions.map(m => m.id);

    // Clear input immediately before streaming starts
    setDraft("");
    setMentions([]);

    console.log("[Page.send] Calling sendMessage with:", {
      content: currentDraft.substring(0, 100),
      targetConversationId,
      mentionIds,
    });

    await sendMessage(currentDraft, targetConversationId ?? undefined, mentionIds);
  }, [isLoading, sendMessage, setDraft, conversationId, createConversation, router]);

  const handleTranscriptClick = (transcript: { id: string; title: string }) => {
    // Add as a chip instead of inserting text
    setMentions(prev => [...prev, { id: transcript.id, title: transcript.title }]);
  };

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
            />
          }
          rightPanel={
            <TranscriptsPanel
              transcripts={transcripts}
              onTranscriptClick={handleTranscriptClick}
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
                value={draft}
                onChange={setDraft}
                mentions={mentions}
                onMentionsChange={setMentions}
                onSend={send}
                onStop={stopGenerating}
                onNewConversation={handleNewChat}
                disabled={isLoading}
                isGenerating={isLoading}
                hasMessages={messages.length > 0}
                transcripts={transcripts}
                model={model}
                onModelChange={changeModel}
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
