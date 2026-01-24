/**
 * useSearch hook - Manages search modal state and debounced search queries
 */

import { useState, useEffect, useRef } from 'react'
import { searchConversations, type SearchResult } from '@/lib/api'

export function useSearch() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Track abort controller to cancel stale requests
  const abortControllerRef = useRef<AbortController | null>(null)

  // Debounce query with 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, 300)

    return () => clearTimeout(timer)
  }, [query])

  // Perform search when debounced query changes
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

  // Keyboard shortcut: Cmd+K / Ctrl+K to open, Escape to close
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Clear query when modal closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setResults(null)
      setError(null)
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
  }
}
