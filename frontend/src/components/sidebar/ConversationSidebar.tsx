"use client";
import { useRouter } from "next/navigation";
import { useConversations } from "@/hooks/useConversations";
import { useSidebar } from "@/hooks/useSidebar";
import { ConversationGroup } from "./ConversationGroup";
import { IOSThemeToggle } from "./IOSThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Search, ChevronsLeft } from "lucide-react";

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

  const handleGoHome = () => {
    router.push("/");
  };

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
          onClick={handleGoHome}
          className="oxy-rail-btn oxy-rail-logo"
          aria-label="Home"
          title="Home"
        >
          <OxyLogo size={20} />
        </button>

        {/* New Chat */}
        <button
          type="button"
          onClick={handleNewChat}
          className="oxy-rail-btn"
          aria-label="New chat (⇧⌘O)"
          title="New chat (⇧⌘O)"
          disabled={isLoading}
        >
          <Plus size={18} />
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
          <Search size={18} />
          <span className="oxy-rail-label">Search</span>
          <kbd className="oxy-rail-kbd">⌘K</kbd>
        </button>
      </div>

      {/* Conversation list - only visible when expanded */}
      {!collapsed && (
        <>
          <ScrollArea className="oxy-rail-list">
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
              <>
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
              </>
            )}
          </ScrollArea>

          {/* Footer */}
          <div className="oxy-rail-footer">
            <IOSThemeToggle />
            <button
              type="button"
              onClick={toggle}
              className="oxy-rail-collapse"
              aria-label="Collapse sidebar (⌘B)"
              title="Collapse sidebar (⌘B)"
            >
              <ChevronsLeft size={16} />
            </button>
          </div>
        </>
      )}

    </div>
  );
}
