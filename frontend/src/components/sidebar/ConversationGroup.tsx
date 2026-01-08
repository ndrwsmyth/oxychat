"use client";

import type { Conversation } from "@/types";
import { ConversationItem } from "./ConversationItem";

interface ConversationGroupProps {
  title: string;
  conversations: Conversation[];
  activeConversationId: string | null;
  isPinned?: boolean;
  onUpdate: (id: string, updates: Partial<Conversation>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
}

export function ConversationGroup({
  title,
  conversations,
  activeConversationId,
  isPinned = false,
  onUpdate,
  onDelete,
  onTogglePin,
}: ConversationGroupProps) {
  if (conversations.length === 0) {
    return null;
  }

  return (
    <div className={`oxy-conversation-group ${isPinned ? "pinned" : ""}`}>
      <div className="oxy-conversation-group-title">{title}</div>
      <div className="oxy-conversation-group-list">
        {conversations.map((conversation) => (
          <ConversationItem
            key={conversation.id}
            conversation={conversation}
            isActive={conversation.id === activeConversationId}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </div>
  );
}
