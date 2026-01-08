"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranscripts } from "@/hooks/useTranscripts";
import { useConversation } from "@/hooks/useConversation";
import { useDraft } from "@/hooks/useDraft";
import { useSearch } from "@/hooks/useSearch";
import { useConversations } from "@/hooks/useConversations";
import { SidebarProvider } from "@/hooks/useSidebar";
import { AppLayout } from "@/components/layout/AppLayout";
import { ConversationSidebar } from "@/components/sidebar/ConversationSidebar";
import { SearchModal } from "@/components/search/SearchModal";
import { OxyHeader } from "@/components/OxyHeader";
import { OxyEmptyState } from "@/components/chat/OxyEmptyState";
import { OxyMessageThread } from "@/components/chat/OxyMessageThread";
import { OxyComposer } from "@/components/chat/OxyComposer";
import { OxyLibraryDrawer } from "@/components/library/OxyLibraryDrawer";
import { ThinkingIndicator } from "@/components/chat/ThinkingIndicator";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conversationId = searchParams.get("c");

  const [showLibrary, setShowLibrary] = useState(false);

  const { transcripts } = useTranscripts();
  const { messages, model, isLoading, error, sendMessage, changeModel } =
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
      {/* Ambient light gradient */}
      <div className="oxy-ambient" />

      {/* Search modal */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setSearchOpen(false)}
        onNewChat={handleNewChat}
      />

      {/* Library drawer */}
      <OxyLibraryDrawer
        open={showLibrary}
        onOpenChange={setShowLibrary}
        transcripts={transcripts}
        onTranscriptClick={handleTranscriptClick}
      />

      {/* Main layout with sidebar */}
      <AppLayout
        sidebar={
          <ConversationSidebar activeConversationId={conversationId} />
        }
        onNewChat={handleNewChat}
        onOpenSearch={handleOpenSearch}
        main={
          <main className="oxy-main">
            <OxyHeader
              showHomeButton={!!conversationId}
              onLibraryClick={() => setShowLibrary(true)}
            />

            {/* Content area */}
            {messages.length === 0 ? (
              <div className="oxy-content">
                <OxyEmptyState />
              </div>
            ) : (
              <>
                <OxyMessageThread messages={messages} isLoading={isLoading} />
                {isLoading && <ThinkingIndicator />}
              </>
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
              disabled={isLoading}
              transcripts={transcripts}
              model={model}
              onModelChange={changeModel}
            />
          </main>
        }
      />
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
