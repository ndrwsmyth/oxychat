"use client";
import { useRouter } from "next/navigation";
import { useSidebar } from "@/hooks/useSidebar";
import { ConversationGroup } from "./ConversationGroup";
import { IOSThemeToggle } from "./IOSThemeToggle";
import { UserAvatar } from "./UserAvatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, ChevronsLeft } from "lucide-react";
import type { Conversation, GroupedConversations } from "@/types";

// Conversation group configuration for rendering
const CONVERSATION_GROUPS: Array<{
  key: keyof GroupedConversations;
  title: string;
  isPinned?: boolean;
}> = [
  { key: "pinned", title: "Pinned", isPinned: true },
  { key: "today", title: "Today" },
  { key: "yesterday", title: "Yesterday" },
  { key: "two_days_ago", title: "2 days ago" },
  { key: "last_7_days", title: "Last 7 days" },
  { key: "last_week", title: "Last week" },
  { key: "older", title: "Older" },
];

// Oxy logo component
function OxyLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 196 196"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M97.8571 0C151.362 0 195.714 43.5773 195.714 97.8571C195.714 152.137 152.133 195.714 97.8571 195.714C43.5765 195.714 0 152.137 0 97.8571C0 43.5773 44.3518 0 97.8571 0ZM97.8571 58.7143L58.7143 97.8571L97.8571 137L137 97.8571L97.8571 58.7143Z"
        fill="currentColor"
      />
    </svg>
  );
}

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onOpenSearch?: () => void;
  conversations: GroupedConversations;
  isLoading: boolean;
  onNewChat: () => void;
  onUpdateConversation: (id: string, updates: Partial<Conversation>) => Promise<void>;
  onDeleteConversation: (id: string) => Promise<void>;
  onTogglePin: (id: string) => Promise<void>;
}

export function ConversationSidebar({
  activeConversationId,
  onOpenSearch,
  conversations,
  isLoading,
  onNewChat,
  onUpdateConversation,
  onDeleteConversation,
  onTogglePin,
}: ConversationSidebarProps) {
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();

  // Click on background area expands when collapsed
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"], .oxy-conversation-item')) return;
    toggle();
  };

  return (
    <div
      className={`oxy-sidebar-rail ${collapsed ? 'collapsed' : 'expanded'}`}
      onClick={handleBackgroundClick}
    >
      {/* Top section: Logo + Actions */}
      <div className="oxy-rail-top">
        {/* Logo - goes home */}
        <button
          type="button"
          onClick={() => router.push("/")}
          className="oxy-rail-btn oxy-rail-logo"
          aria-label="Home"
          title="Home"
        >
          <span className="oxy-rail-icon">
            <OxyLogo size={18} />
          </span>
        </button>

        {/* New Chat */}
        <button
          type="button"
          onClick={onNewChat}
          className="oxy-rail-btn"
          aria-label="New chat (⇧⌘O)"
          title="New chat (⇧⌘O)"
          disabled={isLoading}
        >
          <span className="oxy-rail-icon">
            <Plus size={18} />
          </span>
          <span className="oxy-rail-label">New chat</span>
        </button>

        {/* Search */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="oxy-rail-btn"
          aria-label="Search (⌘K)"
          title="Search (⌘K)"
        >
          <span className="oxy-rail-icon">
            <Search size={18} />
          </span>
          <span className="oxy-rail-label">Search</span>
          <kbd className="oxy-rail-kbd">⌘K</kbd>
        </button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="oxy-rail-list" aria-hidden={collapsed}>
        {isLoading ? (
          <div className="oxy-conversation-group">
            <div className="oxy-conversation-group-title">Loading</div>
            <div className="oxy-conversation-group-list">
              {[85, 70, 90, 75, 80].map((width, i) => (
                <div key={i} className="oxy-skeleton-item">
                  <div className="oxy-skeleton oxy-skeleton-text" style={{ width: `${width}%` }} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          CONVERSATION_GROUPS.map(({ key, title, isPinned }) => (
            <ConversationGroup
              key={key}
              title={title}
              conversations={conversations[key]}
              activeConversationId={activeConversationId}
              isPinned={isPinned}
              onUpdate={onUpdateConversation}
              onDelete={onDeleteConversation}
              onTogglePin={onTogglePin}
            />
          ))
        )}
      </ScrollArea>

      {/* Footer - user avatar, collapse button, theme toggle */}
      <div className="oxy-rail-footer" aria-hidden={collapsed}>
        <div className="oxy-rail-footer-avatar">
          <UserAvatar collapsed={collapsed} />
        </div>
        <button
          type="button"
          onClick={toggle}
          className="oxy-rail-collapse"
          aria-label="Collapse sidebar (⌘B)"
          title="Collapse sidebar (⌘B)"
        >
          <ChevronsLeft size={16} />
        </button>
        <IOSThemeToggle />
      </div>

    </div>
  );
}
