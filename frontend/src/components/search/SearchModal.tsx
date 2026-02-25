'use client'

/**
 * Search Modal - Stripe-level search with framer-motion animations
 * Local-first filtering, keyboard navigation, spring physics
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Conversation } from '@/types'
import { buildHomeUrl } from '@/lib/navigation'

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
  onNewChat: () => void
  // Search state passed from parent (useSearch hook)
  query: string
  setQuery: (query: string) => void
  localResults: Conversation[]
  isSearchingDeeper: boolean
  selectedIndex: number
  setSelectedIndex: (index: number) => void
}

// Utility: Format relative time (e.g., "2h", "Yesterday", "3d")
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w`

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SearchModal({
  isOpen,
  onClose,
  onNewChat,
  query,
  setQuery,
  localResults,
  isSearchingDeeper,
  selectedIndex,
  setSelectedIndex,
}: SearchModalProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef<Map<number, HTMLButtonElement>>(new Map())
  const shouldReduceMotion = useReducedMotion()

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure modal is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Scroll selected item into view
  useEffect(() => {
    const selectedEl = resultRefs.current.get(selectedIndex)
    selectedEl?.scrollIntoView({
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
      block: 'nearest',
    })
  }, [selectedIndex, shouldReduceMotion])

  const handleSelectConversation = (conversationId: string) => {
    const conversation = localResults.find((item) => item.id === conversationId)
    router.push(
      buildHomeUrl({
        conversationId,
        projectId: conversation?.project_id ?? null,
      })
    )
    onClose()
  }

  const handleNewChat = () => {
    onNewChat()
    onClose()
  }

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0, transition: { duration: 0 } },
  }

  const modalVariants = {
    hidden: {
      scale: shouldReduceMotion ? 1 : 0.95,
      opacity: 0,
    },
    visible: {
      scale: 1,
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0 }
        : { type: 'spring' as const, duration: 0.35, bounce: 0.15 },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0 }, // Instant close
    },
  }

  // Separate pinned from recent conversations
  const pinnedResults = localResults.filter(c => c.pinned)
  const recentResults = localResults.filter(c => !c.pinned)

  // Calculate index offset for pinned/recent sections
  // Index 0 = New Chat
  // Index 1 to pinnedResults.length = Pinned
  // Index pinnedResults.length + 1 onwards = Recent
  const getPinnedResultIndex = (i: number) => 1 + i
  const getRecentResultIndex = (i: number) => 1 + pinnedResults.length + i

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/30 dark:bg-black/50 z-[100]"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed left-1/2 top-[20%] -translate-x-1/2 z-[101] oxy-search-modal-v2"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-label="Search conversations"
          >
            {/* Header with input */}
            <div className="oxy-search-header-v2">
              <Search size={18} className="text-[var(--text-tertiary)] flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search conversations..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="oxy-search-input-v2"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              <kbd className="oxy-search-modal-kbd">ESC</kbd>
            </div>

            {/* Results */}
            <ScrollArea className="oxy-search-results-v2">
              {/* New Chat - always at index 0 */}
              <button
                ref={(el) => { if (el) resultRefs.current.set(0, el) }}
                onClick={handleNewChat}
                onMouseEnter={() => setSelectedIndex(0)}
                className="oxy-search-result-v2 oxy-search-new-chat-v2"
                data-selected={selectedIndex === 0}
              >
                <span className="oxy-search-result-title-v2 flex items-center gap-2">
                  <Plus size={16} />
                  New chat
                </span>
              </button>

              {/* Pinned Section */}
              {pinnedResults.length > 0 && (
                <div className="oxy-search-section-v2">
                  <div className="oxy-search-section-label">Pinned</div>
                  {pinnedResults.map((conv, i) => {
                    const idx = getPinnedResultIndex(i)
                    return (
                      <button
                        key={conv.id}
                        ref={(el) => { if (el) resultRefs.current.set(idx, el) }}
                        onClick={() => handleSelectConversation(conv.id)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="oxy-search-result-v2"
                        data-selected={selectedIndex === idx}
                      >
                        <span className="oxy-search-result-title-v2">{conv.title}</span>
                        <span className="oxy-search-result-time-v2">
                          {formatRelativeTime(new Date(conv.updated_at))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Recent Section (or search results) */}
              {recentResults.length > 0 && (
                <div className="oxy-search-section-v2">
                  <div className="oxy-search-section-label">
                    {query.trim() ? 'Results' : 'Recent'}
                  </div>
                  {recentResults.map((conv, i) => {
                    const idx = getRecentResultIndex(i)
                    return (
                      <button
                        key={conv.id}
                        ref={(el) => { if (el) resultRefs.current.set(idx, el) }}
                        onClick={() => handleSelectConversation(conv.id)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className="oxy-search-result-v2"
                        data-selected={selectedIndex === idx}
                      >
                        <span className="oxy-search-result-title-v2">{conv.title}</span>
                        <span className="oxy-search-result-time-v2">
                          {formatRelativeTime(new Date(conv.updated_at))}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Searching deeper indicator */}
              {isSearchingDeeper && (
                <div className="oxy-search-deeper" role="status" aria-live="polite">
                  Searching deeper...
                </div>
              )}

              {/* Empty state when searching */}
              {query.trim() && localResults.length === 0 && !isSearchingDeeper && (
                <div className="oxy-search-state-v2">
                  <span>No conversations match &ldquo;{query}&rdquo;</span>
                </div>
              )}
            </ScrollArea>

            {/* Keyboard hints footer */}
            <div className="oxy-search-hints-v2">
              <span className="oxy-search-hint">
                <kbd>↑</kbd><kbd>↓</kbd> Navigate
              </span>
              <span className="oxy-search-hint">
                <kbd>↵</kbd> Select
              </span>
              <span className="oxy-search-hint">
                <kbd>ESC</kbd> Close
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
