/**
 * Main chat page component with sidebar.
 */

import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { TranscriptSidebar } from "@/components/library/TranscriptSidebar";
import { useChat } from "@/hooks/useChat";
import { MessageCircle, Trash2, PanelRightClose, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function ChatPage() {
  const { messages, isLoading, error, sendMessage, clearMessages } = useChat();
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <div className="flex h-screen">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b px-4 py-3 flex items-center justify-between bg-background shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">OxyChat</h1>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-muted-foreground hover:text-foreground"
            >
              {showSidebar ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </header>

        {/* Messages */}
        <MessageList messages={messages} />

        {/* Error display */}
        {error && (
          <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm text-center shrink-0">
            {error}
          </div>
        )}

        {/* Input */}
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>

      {/* Sidebar */}
      {showSidebar && <TranscriptSidebar />}
    </div>
  );
}
