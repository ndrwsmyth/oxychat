"use client";

import { useCallback, useState, Suspense } from "react";
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

  const { transcripts, isLoading: transcriptsLoading } = useTranscripts();
  const { createConversation, refresh: refreshConversations } = useConversations();

  // Refresh conversations list when title is auto-updated
  const handleTitleUpdate = useCallback((title: string) => {
    console.log("[Page] Title update received, refreshing conversations:", title);
    refreshConversations();
  }, [refreshConversations]);

  const { messages, model, isLoading, isThinking, error, sendMessage, stopGenerating, changeModel } =
    useConversation(conversationId, transcripts, { onTitleUpdate: handleTitleUpdate });
  const { draft, setDraft } = useDraft(conversationId);
  const { isOpen: isSearchOpen, setIsOpen: setSearchOpen } = useSearch();
  const [mentions, setMentions] = useState<MentionChip[]>([]);

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
        // If conversation creation fails (e.g., backend not running),
        // still allow sending message in ephemeral mode
        console.warn("Failed to create conversation, using ephemeral mode:", err);
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
              isLoading={transcriptsLoading}
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
