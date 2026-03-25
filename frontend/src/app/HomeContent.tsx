"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useConversation } from "@/hooks/useConversation";
import { getDraft, saveDraft, clearDraft, cleanupDrafts, type DraftData, type MentionChip } from "@/hooks/useDrafts";
import { SharedAppShell } from "@/components/layout/SharedAppShell";
import { useAppShell } from "@/contexts/AppShellContext";
import { OxyHeader } from "@/components/OxyHeader";
import { OxyEmptyState } from "@/components/chat/OxyEmptyState";
import { OxyMessageThread } from "@/components/chat/OxyMessageThread";
import { OxyComposer } from "@/components/chat/OxyComposer";
import { buildHomeUrl } from "@/lib/navigation";
import type { WorkspaceTreeClient } from "@/types";

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
  return (
    <SharedAppShell>
      <HomeContentInner />
    </SharedAppShell>
  );
}

function HomeContentInner() {
  const {
    conversationId,
    selectedProjectId,
    workspaceClients,
    createConversation,
    updateConversationTitle,
  } = useAppShell();

  const router = useRouter();

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

  const selectedProjectContext = findSelectedProjectContext(selectedProjectId, workspaceClients);

  const pushUrl = useCallback((nextUrl: string) => {
    router.push(nextUrl, { scroll: false });
  }, [router]);

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

  return (
    <div className="oxy-chat-container">
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
          onNewConversation={() => pushUrl(buildHomeUrl({ projectId: selectedProjectId }))}
          disabled={isStreaming || !isModelsReady || !model}
          isGenerating={isStreaming}
          hasMessages={messages.length > 0}
          projectId={selectedProjectId}
          conversationId={conversationId}
          model={model}
          modelOptions={modelOptions}
          onModelChange={changeModel}
          draftToRestore={draftToRestore}
          onDraftRestored={handleDraftRestored}
        />
      </main>
    </div>
  );
}
