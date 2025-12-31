"use client";

import { useState, useCallback } from "react";
import { useTranscripts } from "@/hooks/useTranscripts";
import { useChat } from "@/hooks/useChat";
import { OxyHeader } from "@/components/OxyHeader";
import { OxyEmptyState } from "@/components/chat/OxyEmptyState";
import { OxyMessageThread } from "@/components/chat/OxyMessageThread";
import { OxyComposer } from "@/components/chat/OxyComposer";
import { OxyLibraryDrawer } from "@/components/library/OxyLibraryDrawer";

export default function Home() {
  const [input, setInput] = useState("");
  const [showLibrary, setShowLibrary] = useState(false);

  const { transcripts } = useTranscripts();
  const { messages, isLoading, sendMessage } = useChat(transcripts);

  const send = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    await sendMessage(input.trim());
    setInput("");
  }, [input, isLoading, sendMessage]);

  const handleTranscriptClick = (title: string) => {
    setInput((prev) => {
      const prefix = prev.endsWith(" ") || prev === "" ? "" : " ";
      return `${prev}${prefix}@${title} `;
    });
  };

  return (
    <>
      {/* Ambient light gradient */}
      <div className="oxy-ambient" />

      {/* Library drawer */}
      <OxyLibraryDrawer
        open={showLibrary}
        onOpenChange={setShowLibrary}
        transcripts={transcripts}
        onTranscriptClick={handleTranscriptClick}
      />

      {/* Main surface */}
      <main className="oxy-main">
        <OxyHeader onLibraryClick={() => setShowLibrary(true)} />

        {/* Content area */}
        {messages.length === 0 ? (
          <div className="oxy-content">
            <OxyEmptyState onStarterClick={setInput} />
          </div>
        ) : (
          <OxyMessageThread messages={messages} isLoading={isLoading} />
        )}

        {/* Composer */}
        <OxyComposer
          value={input}
          onChange={setInput}
          onSend={send}
          disabled={isLoading}
          transcripts={transcripts}
        />
      </main>
    </>
  );
}
