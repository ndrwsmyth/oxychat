"use client";

import { useCallback, Suspense } from "react";
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
import { OxyComposer } from "@/components/chat/OxyComposer";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  const { transcripts } = useTranscripts();
  const { messages, model, isLoading, isThinking, error, sendMessage, stopGenerating, changeModel } =
    useConversation(conversationId, transcripts);
  const { draft, setDraft } = useDraft(conversationId);
  const { isOpen: isSearchOpen, setIsOpen: setSearchOpen } = useSearch();
  const { createConversation } = useConversations();

  const send = useCallback(async () => {
    if (!draft.trim() || isLoading) return;
    await sendMessage(draft.trim());
    setDraft("");
  }, [draft, isLoading, sendMessage, setDraft]);

  const handleTranscriptClick = (title: string) => {
    setDraft((prev) => {
      const prefix = prev.endsWith(" ") || prev === "" ? "" : " ";
      return `${prev}${prefix}@${title} `;
    });
  };

  const handleNewChat = useCallback(async () => {
    const newConv = await createConversation("New conversation");
    router.push(`/?c=${newConv.id}`);
  }, [createConversation, router]);

  const handleOpenSearch = useCallback(() => {
    setSearchOpen(true);
  }, [setSearchOpen]);

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
