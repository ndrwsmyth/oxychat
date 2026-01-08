"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useConversations } from "@/hooks/useConversations";
import { ConversationGroup } from "./ConversationGroup";
import { IOSThemeToggle } from "./IOSThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Search } from "lucide-react";

interface ConversationSidebarProps {
  activeConversationId: string | null;
}

export function ConversationSidebar({ activeConversationId }: ConversationSidebarProps) {
  const router = useRouter();
  const {
    conversations,
    isLoading,
    createConversation,
    updateConversation,
    deleteConversation,
    togglePin,
  } = useConversations();

  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    if (!debouncedSearch.trim()) {
      return conversations;
    }

    const query = debouncedSearch.toLowerCase();
    const filterList = (list: typeof conversations.today) =>
      list.filter((c) => c.title.toLowerCase().includes(query));

    return {
      pinned: filterList(conversations.pinned),
      today: filterList(conversations.today),
      yesterday: filterList(conversations.yesterday),
      last_7_days: filterList(conversations.last_7_days),
      last_30_days: filterList(conversations.last_30_days),
      older: filterList(conversations.older),
    };
  }, [conversations, debouncedSearch]);

  const handleNewChat = async () => {
    const newConv = await createConversation("New conversation");
    router.push(`/?c=${newConv.id}`);
  };

  return (
    <div className="oxy-sidebar-content">
      <div className="oxy-sidebar-header">
        <Button
          onClick={handleNewChat}
          className="oxy-new-chat-btn"
          disabled={isLoading}
        >
          <Plus size={16} />
          New chat
        </Button>
      </div>

      <div className="oxy-sidebar-search">
        <Search size={16} className="oxy-search-icon" />
        <Input
          type="text"
          placeholder="Search conversations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="oxy-search-input"
        />
      </div>

      <ScrollArea className="oxy-sidebar-list">
        <ConversationGroup
          title="Pinned"
          conversations={filteredConversations.pinned}
          activeConversationId={activeConversationId}
          isPinned
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Today"
          conversations={filteredConversations.today}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Yesterday"
          conversations={filteredConversations.yesterday}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Last 7 days"
          conversations={filteredConversations.last_7_days}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Last 30 days"
          conversations={filteredConversations.last_30_days}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Older"
          conversations={filteredConversations.older}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />
      </ScrollArea>

      {/* Theme toggle footer */}
      <div className="oxy-sidebar-footer">
        <IOSThemeToggle />
      </div>
    </div>
  );
}
