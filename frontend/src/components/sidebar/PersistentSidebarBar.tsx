'use client'

/**
 * Persistent sidebar bar - always visible on the left edge
 * Contains collapse/expand, new chat, and search buttons
 */

import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'

interface PersistentSidebarBarProps {
  isCollapsed: boolean
  onToggleCollapse: () => void
  onNewChat: () => void
  onOpenSearch: () => void
}

export function PersistentSidebarBar({
  isCollapsed,
  onToggleCollapse,
  onNewChat,
  onOpenSearch,
}: PersistentSidebarBarProps) {
  return (
    <div className="oxy-persistent-bar">
      {/* Collapse/Expand Button */}
      <button
        onClick={onToggleCollapse}
        className="oxy-persistent-bar-btn"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? (
          <ChevronRight className="w-5 h-5" />
        ) : (
          <ChevronLeft className="w-5 h-5" />
        )}
      </button>

      {/* New Chat Button */}
      <button
        onClick={onNewChat}
        className="oxy-persistent-bar-btn"
        aria-label="New chat"
        title="New chat"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Search Button */}
      <button
        onClick={onOpenSearch}
        className="oxy-persistent-bar-btn"
        aria-label="Search (Cmd+K)"
        title="Search (Cmd+K)"
      >
        <Search className="w-5 h-5" />
      </button>
    </div>
  )
}
