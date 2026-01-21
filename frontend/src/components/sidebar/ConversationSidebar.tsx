"use client";
import { useRouter } from "next/navigation";
import { useConversations } from "@/hooks/useConversations";
import { useSidebar } from "@/hooks/useSidebar";
import { ConversationGroup } from "./ConversationGroup";
import { IOSThemeToggle } from "./IOSThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, ChevronRight, ChevronsLeft } from "lucide-react";

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
}

export function ConversationSidebar({ activeConversationId, onOpenSearch }: ConversationSidebarProps) {
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const {
    conversations,
    isLoading,
    createConversation,
    updateConversation,
    deleteConversation,
    togglePin,
  } = useConversations();


  const handleNewChat = async () => {
    const newConv = await createConversation("New conversation");
    router.push(`/?c=${newConv.id}`);
  };

  // Collapsed state - show only icon buttons with hover-to-expand
  if (collapsed) {
    return (
      <div className="oxy-sidebar-collapsed" onClick={toggle}>
        {/* Hover expand indicator - shows on sidebar hover */}
        <div className="oxy-sidebar-expand-indicator">
          <ChevronRight className="w-4 h-4" />
        </div>

        <div className="oxy-sidebar-collapsed-buttons">
          {/* Logo - click to expand */}
          <button
            onClick={(e) => { e.stopPropagation(); toggle(); }}
            className="oxy-sidebar-icon-btn oxy-sidebar-logo-btn"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <OxyLogo size={28} />
          </button>

          {/* Search - first action */}
          <button
            onClick={(e) => { e.stopPropagation(); onOpenSearch?.(); }}
            className="oxy-sidebar-icon-btn"
            aria-label="Search (Cmd+K)"
            title="Search (Cmd+K)"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* New chat - second action */}
          <button
            onClick={(e) => { e.stopPropagation(); handleNewChat(); }}
            className="oxy-sidebar-icon-btn"
            aria-label="New chat"
            title="New chat"
            disabled={isLoading}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // Handle background click to collapse
  const handleBackgroundClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't collapse if clicking on interactive elements
    if (target.closest('button, a, input, [role="button"], .oxy-sidebar-item, .oxy-conversation-item')) return;
    toggle();
  };

  // Expanded state - show full content
  return (
    <div className="oxy-sidebar-content" onClick={handleBackgroundClick}>
      {/* Logo */}
      <div className="oxy-sidebar-logo">
        <OxyLogo size={28} />
      </div>

      {/* Search bar - clickable, opens search modal */}
      <div className="oxy-sidebar-actions">
        <button
          type="button"
          onClick={onOpenSearch}
          className="oxy-sidebar-search-btn"
        >
          <Search size={16} />
          <span>Search</span>
          <kbd>⌘K</kbd>
        </button>

        {/* New chat item */}
        <button
          type="button"
          onClick={handleNewChat}
          className="oxy-sidebar-menu-item"
          disabled={isLoading}
        >
          <Plus size={16} />
          <span>New chat</span>
        </button>
      </div>

      <ScrollArea className="oxy-sidebar-list">
        <ConversationGroup
          title="Pinned"
          conversations={conversations.pinned}
          activeConversationId={activeConversationId}
          isPinned
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Today"
          conversations={conversations.today}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Yesterday"
          conversations={conversations.yesterday}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Last 7 days"
          conversations={conversations.last_7_days}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Last 30 days"
          conversations={conversations.last_30_days}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />

        <ConversationGroup
          title="Older"
          conversations={conversations.older}
          activeConversationId={activeConversationId}
          onUpdate={updateConversation}
          onDelete={deleteConversation}
          onTogglePin={togglePin}
        />
      </ScrollArea>

      {/* Footer with theme toggle and collapse button */}
      <div className="oxy-sidebar-footer">
        <IOSThemeToggle />
        <button
          type="button"
          onClick={toggle}
          className="oxy-sidebar-collapse-btn"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <ChevronsLeft size={18} />
        </button>
      </div>
    </div>
  );
}
