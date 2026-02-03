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
    useConversation(conversationId, transcripts, { onTitleUpdate: handleTitleUpdate });
  const { draft, setDraft } = useDraft(conversationId);
  const [mentions, setMentions] = useState<MentionChip[]>([]);

  const handleNewChat = useCallback(async () => {
    const newConv = await createConversation();
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
    if (!currentDraft || isStreaming) return;

    let targetConversationId = conversationId;

    // Create conversation on first message if needed
    if (!targetConversationId) {
      try {
        const newConv = await createConversation();
        targetConversationId = newConv.id;
        router.push(`/?c=${targetConversationId}`, { scroll: false });
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return;
      }
    }

    const mentionIds = passedMentions.map(m => m.id);

    // Clear input immediately before streaming starts
    setDraft("");
    setMentions([]);

    await sendMessage(currentDraft, targetConversationId ?? undefined, mentionIds);
  }, [isStreaming, sendMessage, setDraft, conversationId, createConversation, router]);

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
                disabled={isStreaming}
                isGenerating={isStreaming}
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
