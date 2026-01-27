'use client'

/**
 * Search Modal - Full-text search across conversations and messages
 * Opens with Cmd+K / Ctrl+K
 */

import { useRouter } from 'next/navigation'
import { Search, Plus, MessageSquare, Clock } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSearch } from '@/hooks/useSearch'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onNewChat: () => void
}

// Hoisted: Truncate message preview to ~150 characters
function truncateContent(content: string, maxLength: number = 150) {
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength) + '...'
}

export function SearchModal({ isOpen, onClose, onNewChat }: SearchModalProps) {
  const router = useRouter()
  const { query, setQuery, results, isLoading, error } = useSearch()

  const handleSelectConversation = (conversationId: string) => {
    router.push(`/?c=${conversationId}`)
    onClose()
  }

  const handleNewChat = () => {
    onNewChat()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="oxy-search-modal">
        <DialogTitle className="sr-only">Search conversations</DialogTitle>
        {/* Search Input */}
        <div className="oxy-search-modal-header">
          <Search size={20} className="oxy-search-modal-icon" />
          <input
            type="text"
            placeholder="Search chats..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="oxy-search-modal-input"
            autoFocus
          />
          <kbd className="oxy-search-modal-kbd">ESC</kbd>
        </div>

        {/* Results */}
        <ScrollArea className="oxy-search-modal-results">
          {/* New Chat Option (always visible) */}
          <button onClick={handleNewChat} className="oxy-search-result oxy-search-new-chat">
            <div className="oxy-search-result-icon">
              <Plus size={18} />
            </div>
            <div className="oxy-search-result-content">
              <div className="oxy-search-result-title">New chat</div>
              <div className="oxy-search-result-subtitle">Start a new conversation</div>
            </div>
          </button>

          {/* Loading State */}
          {isLoading && (
            <div className="oxy-search-state" role="status" aria-live="polite">
              <div className="oxy-search-spinner" aria-hidden="true" />
              <span>Searching...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="oxy-search-state oxy-search-error">
              <span>{error}</span>
            </div>
          )}

          {/* Conversations Section */}
          {results && results.conversations.length > 0 && (
            <div className="oxy-search-section">
              <div className="oxy-search-section-title">Conversations</div>
              {results.conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv.id)}
                  className="oxy-search-result"
                >
                  <div className="oxy-search-result-icon">
                    <MessageSquare size={18} />
                  </div>
                  <div className="oxy-search-result-content">
                    <div className="oxy-search-result-title">{conv.title}</div>
                    <div className="oxy-search-result-subtitle">
                      {conv.message_count} {conv.message_count === 1 ? 'message' : 'messages'} · {' '}
                      {formatRelativeTime(new Date(conv.updated_at))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Messages Section */}
          {results && results.messages.length > 0 && (
            <div className="oxy-search-section">
              <div className="oxy-search-section-title">Messages</div>
              {results.messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => handleSelectConversation(msg.conversation_id)}
                  className="oxy-search-result"
                >
                  <div className="oxy-search-result-icon">
                    <Clock size={18} />
                  </div>
                  <div className="oxy-search-result-content">
                    <div className="oxy-search-result-title">{msg.conversation_title}</div>
                    <div className="oxy-search-result-preview">
                      {truncateContent(msg.content)}
                    </div>
                    <div className="oxy-search-result-subtitle">
                      {formatRelativeTime(new Date(msg.created_at))}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {results && results.total_results === 0 && !isLoading && (
            <div className="oxy-search-state">
              <span>No results found for &ldquo;{query}&rdquo;</span>
            </div>
          )}

          {/* Empty State (no query) */}
          {!query && !results && !isLoading && (
            <div className="oxy-search-state oxy-search-empty">
              <Search size={32} className="oxy-search-empty-icon" />
              <span>Search across all your conversations and messages</span>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}

// Utility: Format relative time (e.g., "2 hours ago", "Yesterday")
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffDays / 7)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}
