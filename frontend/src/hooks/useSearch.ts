/**
 * useSearch hook - Manages search modal state with local-first filtering and keyboard navigation
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { searchConversations, type SearchResult } from '@/lib/api'
import type { Conversation, GroupedConversations } from '@/types'

// Flatten grouped conversations into a single array
function flattenConversations(grouped: GroupedConversations): Conversation[] {
  return [
    ...grouped.pinned,
    ...grouped.today,
    ...grouped.yesterday,
    ...grouped.last_7_days,
    ...grouped.last_30_days,
    ...grouped.older,
  ]
}

interface UseSearchOptions {
  conversations?: GroupedConversations
  onSelectConversation?: (conversationId: string) => void
  onNewChat?: () => void
}

export interface UseSearchReturn {
  isOpen: boolean
  setIsOpen: (open: boolean) => void
  query: string
  setQuery: (query: string) => void
  results: SearchResult | null
  isLoading: boolean
  error: string | null
  // New: local-first filtering
  localResults: Conversation[]
  isSearchingDeeper: boolean
  // New: keyboard navigation
  selectedIndex: number
  setSelectedIndex: (index: number) => void
  selectNext: () => void
  selectPrevious: () => void
  handleSelect: () => void
  // Total result count for keyboard navigation
  totalResults: number
}

export function useSearch(options: UseSearchOptions = {}): UseSearchReturn {
  const { conversations, onSelectConversation, onNewChat } = options

  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Track abort controller to cancel stale requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Local-first filtering: filter sidebar conversations instantly
  const localResults = useMemo(() => {
    if (!query.trim() || !conversations) return []

    const flatList = flattenConversations(conversations)
    const lowerQuery = query.toLowerCase()

    return flatList.filter(conv =>
      conv.title.toLowerCase().includes(lowerQuery)
    )
  }, [query, conversations])

  // Total results count: 1 (new chat) + local results + (API results if searching)
  const totalResults = useMemo(() => {
    // Always have "New Chat" at index 0
    return 1 + localResults.length
  }, [localResults])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, localResults.length])

  // Debounce query with 300ms delay for API search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Perform API search when debounced query changes (searching deeper)
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(null)
      setError(null)
      return
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    const performSearch = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const searchResults = await searchConversations(debouncedQuery)
        setResults(searchResults)
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return
        }
        setError(err instanceof Error ? err.message : 'Search failed')
        setResults(null)
      } finally {
        setIsLoading(false)
      }
    }

    performSearch()

    return () => {
      // Cleanup: abort on unmount or query change
      abortControllerRef.current?.abort()
    }
  }, [debouncedQuery])

  // isSearchingDeeper: true when we have local results but API search is in progress
  const isSearchingDeeper = isLoading && query.trim().length > 0 && localResults.length >= 0

  // Keyboard navigation
  const selectNext = useCallback(() => {
    setSelectedIndex(prev => (prev + 1) % totalResults)
  }, [totalResults])

  const selectPrevious = useCallback(() => {
    setSelectedIndex(prev => (prev - 1 + totalResults) % totalResults)
  }, [totalResults])

  // Handle selection (Enter key or click)
  const handleSelect = useCallback(() => {
    if (selectedIndex === 0) {
      // New Chat
      onNewChat?.()
      setIsOpen(false)
    } else {
      // Select conversation from local results
      const resultIndex = selectedIndex - 1 // -1 because index 0 is "New Chat"
      const conv = localResults[resultIndex]
      if (conv) {
        onSelectConversation?.(conv.id)
        setIsOpen(false)
      }
    }
  }, [selectedIndex, localResults, onSelectConversation, onNewChat])

  // Keyboard shortcut: Cmd+K / Ctrl+K to toggle, Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Toggle with Cmd+K / Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(prev => !prev) // Toggle behavior
        return
      }

      // Only handle other keys when modal is open
      if (!isOpen) return

      if (e.key === 'Escape') {
        e.preventDefault()
        setIsOpen(false)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        selectNext()
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        selectPrevious()
      } else if (e.key === 'Enter') {
        e.preventDefault()
        handleSelect()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectNext, selectPrevious, handleSelect])

  // Clear query when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults(null)
      setError(null)
      setSelectedIndex(0)
    }
  }, [isOpen])

  return {
    isOpen,
    setIsOpen,
    query,
    setQuery,
    results,
    isLoading,
    error,
    localResults,
    isSearchingDeeper,
    selectedIndex,
    setSelectedIndex,
    selectNext,
    selectPrevious,
    handleSelect,
    totalResults,
  }
}
