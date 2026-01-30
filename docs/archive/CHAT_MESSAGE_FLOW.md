# Chat Message Flow Analysis: OxyChat

This document traces the complete execution path for when a user sends a message in the chat, including @mention resolution, streaming response, and auto-title generation.

---

## Flow Summary

When a user sends a message in OxyChat, the flow begins in the `OxyComposer` component which captures text and @mentions via DOM manipulation. On submit, the `page.tsx` orchestrator creates a conversation if needed, then delegates to `useConversation.sendMessage()` which performs optimistic UI updates and initiates an SSE streaming request to `POST /api/chat/stream`.

The backend receives the request in `chat.py`, validates the conversation ID, creates a Turn record for audit tracking, and persists the user message. It then resolves @mentions by querying the `Meeting` table for full transcript content, which gets injected into the system prompt. The request flows to `chat_service.py` which selects the appropriate AI provider (Anthropic, OpenAI, or xAI) and streams the response back as SSE events.

The frontend parses these SSE chunks in real-time, updating the assistant message content progressively. After streaming completes, the backend saves the assistant message and checks if this is the first exchange—if so, it generates an auto-title via GPT-4o-mini and emits a `title_update` event. The frontend receives this and refreshes the sidebar conversation list to display the new title.

---

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND (Next.js)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                       │
│  │  OxyComposer    │    │    page.tsx     │    │ useConversation │                       │
│  │                 │    │                 │    │                 │                       │
│  │ 1. User types   │───▶│ 2. send()       │───▶│ 3. sendMessage()│                       │
│  │ 2. @mention     │    │    validates    │    │    optimistic   │                       │
│  │    detected     │    │    creates conv │    │    UI update    │                       │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘                       │
│                                                         │                                │
│                                                         ▼                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                       │
│  │ useConversations│◀───│    page.tsx     │◀───│    api.ts       │                       │
│  │                 │    │                 │    │                 │                       │
│  │ 7. refresh()    │    │ 6. onTitleUpdate│    │ 4. streamChat() │                       │
│  │    sidebar      │    │    callback     │    │    SSE parsing  │                       │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘                       │
│                                                         │                                │
└─────────────────────────────────────────────────────────┼────────────────────────────────┘
                                                          │
                              POST /api/chat/stream       │
                              SSE Response ◀──────────────┘
                                                          │
┌─────────────────────────────────────────────────────────┼────────────────────────────────┐
│                                    BACKEND (FastAPI)                                     │
├─────────────────────────────────────────────────────────┼────────────────────────────────┤
│                                                         ▼                                │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐                       │
│  │ routers/chat.py │───▶│   converters    │───▶│  chat_service   │                       │
│  │                 │    │                 │    │                 │                       │
│  │ 5. stream_chat()│    │ 7. build_context│    │ 8. stream_      │                       │
│  │ 6. Create Turn  │    │    _from_       │    │    response()   │                       │
│  │    Save user msg│    │    mentions()   │    │                 │                       │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘                       │
│                                                         │                                │
│  ┌─────────────────┐    ┌─────────────────┐             ▼                                │
│  │   auto_title    │    │    database     │    ┌─────────────────┐                       │
│  │                 │    │                 │    │    providers/   │                       │
│  │ 11. generate_   │    │ Query Meeting   │    │                 │                       │
│  │     title()     │◀───│ table for       │    │ 9. Anthropic/   │                       │
│  │                 │    │ transcript      │    │    OpenAI/xAI   │                       │
│  └────────┬────────┘    │ content         │    │    stream       │                       │
│           │             └─────────────────┘    └────────┬────────┘                       │
│           │                                             │                                │
│           └──────────────▶ 12. title_update event ◀─────┘                                │
│                            10. Save assistant msg                                        │
│                                                                                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Step-by-Step Trace

### Phase 1: User Input Capture

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 1.1 | `OxyComposer.tsx` | 488-504 | `contentEditable div` | User types in editor |
| 1.2 | `OxyComposer.tsx` | 206-230 | `handleInput()` | Detects `@` trigger, shows mention popover |
| 1.3 | `OxyComposer.tsx` | 232-327 | `insertMentionPill()` | Inserts DOM pill element for selected mention |
| 1.4 | `OxyComposer.tsx` | 196-204 | `syncToParent()` | Extracts content + mentions, calls `onChange`/`onMentionsChange` |

### Phase 2: Message Submission

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 2.1 | `OxyComposer.tsx` | 329-348 | `handleSend()` | Extracts final content, calls `onSend(content, mentions)` |
| 2.2 | `page.tsx` | 41-94 | `send()` | Validates content, guards against double-submit |
| 2.3 | `page.tsx` | 67-78 | `createConversation()` | Creates new conversation if none exists |
| 2.4 | `page.tsx` | 84-85 | - | Clears draft and mentions immediately |
| 2.5 | `page.tsx` | 93 | `sendMessage()` | Delegates to `useConversation` hook |

### Phase 3: Optimistic UI & API Call

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 3.1 | `useConversation.ts` | 85-91 | - | Creates optimistic user message object |
| 3.2 | `useConversation.ts` | 93 | `setMessages()` | Updates UI immediately with user message |
| 3.3 | `useConversation.ts` | 111-125 | - | Creates assistant message placeholder |
| 3.4 | `useConversation.ts` | 127 | `streamChat()` | Initiates SSE streaming request |
| 3.5 | `api.ts` | 144-156 | `fetch()` | `POST /api/chat/stream` with messages, mentions, model |

### Phase 4: Backend Request Processing

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 4.1 | `chat.py` | 201 | `stream_chat()` | FastAPI endpoint entry point |
| 4.2 | `chat.py` | 239-250 | - | Validates conversation_id format |
| 4.3 | `chat.py` | 252-260 | - | Queries `Conversation` table if ID provided |
| 4.4 | `chat.py` | 263-279 | - | Creates new `Turn` record with sequence number |
| 4.5 | `chat.py` | 284-298 | - | Saves user `Message` to database |

### Phase 5: Context Resolution (@Mentions)

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 5.1 | `chat.py` | 312-323 | `build_context_from_mentions()` | Called if mentions provided |
| 5.2 | `chat.py` | 77 | `get_meeting_by_doc_id()` | Queries `Meeting` table for each doc_id |
| 5.3 | `database.py` | 138-144 | - | `SELECT * FROM meetings WHERE doc_id = ?` |
| 5.4 | `chat.py` | 85-116 | - | Applies token budget (100K max), truncates if needed |
| 5.5 | `chat.py` | 122-126 | - | Formats as XML: `<document title="..." doc_id="...">` |
| 5.6 | `chat.py` | 138-144 | - | Wraps all docs in `<user_documents>` block |

### Phase 6: LLM Streaming

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 6.1 | `chat_service.py` | 57-59 | `stream_response()` | Gets system prompt, appends context |
| 6.2 | `chat_service.py` | 63 | `ProviderRegistry.get()` | Looks up provider for model ID |
| 6.3 | `chat_service.py` | 73-77 | `provider.stream_response()` | Streams from Anthropic/OpenAI/xAI |
| 6.4 | `anthropic_provider.py` | 83-115 | - | Yields `StreamEvent` objects |
| 6.5 | `chat_service.py` | 78 | `_event_to_sse()` | Converts to `data: {json}\n\n` format |

### Phase 7: SSE Response Handling

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 7.1 | `chat.py` | 349-359 | `generate()` | Yields `sources` metadata event (if any) |
| 7.2 | `chat.py` | 364-380 | - | Streams content chunks, accumulates for DB |
| 7.3 | `api.ts` | 176-228 | - | Parses SSE chunks: `data: {json}\n\n` |
| 7.4 | `api.ts` | 193-197 | `onChunk()` | Calls callback for `"content"` events |
| 7.5 | `useConversation.ts` | 133-139 | `setMessages()` | Updates assistant message content progressively |

### Phase 8: Post-Stream Database Operations

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 8.1 | `chat.py` | 383-399 | - | Saves assistant `Message` to database |
| 8.2 | `chat.py` | 397 | - | Updates `conversation.updated_at` timestamp |
| 8.3 | `chat.py` | 398 | `session.commit()` | Commits all changes |

### Phase 9: Auto-Title Generation

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 9.1 | `chat.py` | 402-406 | - | Checks if conversation not yet auto-titled |
| 9.2 | `chat.py` | 409 | - | Verifies exactly 2 messages (first exchange) |
| 9.3 | `chat.py` | 411 | `generate_title()` | Calls auto-title service |
| 9.4 | `auto_title.py` | 21-35 | - | Calls GPT-4o-mini for 3-5 word title |
| 9.5 | `chat.py` | 412-414 | - | Updates conversation title, commits |
| 9.6 | `chat.py` | 417 | - | Yields `title_update` SSE event |

### Phase 10: Frontend Title Update

| Step | File | Line | Function | Description |
|------|------|------|----------|-------------|
| 10.1 | `api.ts` | 209-213 | - | Parses `"title_update"` event |
| 10.2 | `useConversation.ts` | 158-160 | `onTitleUpdate()` | Forwards to parent callback |
| 10.3 | `page.tsx` | 30-33 | `handleTitleUpdate()` | Calls `refreshConversations()` |
| 10.4 | `useConversations.ts` | 84 | `refresh()` | Reloads conversation list from API |
| 10.5 | `ConversationSidebar.tsx` | - | - | Re-renders with new title |

---

## Key Files and Their Roles

| File | Role |
|------|------|
| `frontend/src/components/chat/OxyComposer.tsx` | User input capture, @mention detection, DOM pill insertion |
| `frontend/src/app/page.tsx` | Main orchestrator, conversation creation, send coordination |
| `frontend/src/hooks/useConversation.ts` | Message state, optimistic updates, streaming coordination |
| `frontend/src/hooks/useConversations.ts` | Sidebar state, CRUD operations, title refresh |
| `frontend/src/lib/api.ts` | API client, SSE parsing, auth headers |
| `backend/app/routers/chat.py` | Main streaming endpoint, DB operations, context building |
| `backend/app/services/chat_service.py` | Provider orchestration, SSE conversion |
| `backend/app/services/providers/*.py` | LLM API integration (Anthropic, OpenAI, xAI) |
| `backend/app/services/auto_title.py` | GPT-4o-mini title generation |
| `backend/app/database.py` | SQLAlchemy models, DB queries |
| `backend/app/converters.py` | @mention parsing utilities |

---

## Database Operations Summary

| Operation | Table | When |
|-----------|-------|------|
| SELECT | `Conversation` | Lookup by ID on request |
| SELECT | `Turn` | Get last sequence number |
| INSERT | `Turn` | Create turn for this exchange |
| INSERT | `Message` | Save user message |
| SELECT | `Meeting` | Resolve @mentions to transcript content |
| INSERT | `Message` | Save assistant response |
| UPDATE | `Conversation` | Update `updated_at` timestamp |
| UPDATE | `Conversation` | Set `title` and `auto_titled` flag |
| INSERT | `ToolCall` | Track @mention usage (optional) |
| INSERT | `RetrievalResult` | Track RAG results (if used) |

---

## SSE Event Sequence

The backend sends Server-Sent Events in this order:

```
1. data: {"type": "sources", "sources": [...], "truncation_info": [...]}
2. data: {"type": "thinking_start"}
3. data: {"type": "thinking", "content": "..."}  (repeated)
4. data: {"type": "thinking_end"}
5. data: {"type": "content", "content": "..."}   (repeated)
6. data: {"type": "title_update", "title": "..."}  (first exchange only)
7. data: {"type": "done"}
```

### Event Type Details

| Event Type | Description | Payload |
|------------|-------------|---------|
| `sources` | Metadata about resolved @mentions | `sources`, `truncation_info`, `failed_mentions` arrays |
| `thinking_start` | Indicates model is reasoning | Empty |
| `thinking` | Reasoning content chunk | `content` string |
| `thinking_end` | Reasoning complete | Empty |
| `content` | Response text chunk | `content` string |
| `title_update` | Auto-generated title | `title` string |
| `done` | Stream complete | Empty |
| `error` | Error occurred | `error` string |

---

## Request/Response Formats

### Chat Stream Request

```typescript
POST /api/chat/stream
Content-Type: application/json
Authorization: Bearer <supabase_jwt>

{
  "conversation_id": "uuid-string",        // Optional, creates new if omitted
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "mentions": ["doc_123", "doc_456"],      // @mention doc IDs
  "model": "claude-sonnet-4.5",                // Model identifier
  "use_rag": false                         // RAG fallback flag
}
```

### Mention Context Format (Injected into System Prompt)

```xml
<user_documents>
The user has shared the following documents for context:

<document title="Weekly Planning" date="2024-01-15" doc_id="doc_123">
[Full transcript content here...]
</document>

<document title="Sales Meeting" date="2024-01-14" doc_id="doc_456">
[Full transcript content here...]
</document>
</user_documents>
```

---

## Database Models

### Conversation

```python
class Conversation:
    id: UUID                    # Primary key
    title: str                  # Max 500 chars
    auto_titled: bool           # True if system-generated
    model: str                  # Default model for conversation
    pinned: bool                # User pinned to top
    user_id: UUID               # Owner (nullable for legacy)
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime        # Soft delete
```

### Message

```python
class Message:
    id: UUID                    # Primary key
    conversation_id: UUID       # Foreign key, indexed
    turn_id: str                # Foreign key to Turn
    role: str                   # "user" or "assistant"
    content: str                # Full message text
    model: str                  # Model used (assistant only)
    mentions: list              # JSON array of doc IDs
    created_at: datetime
```

### Turn

```python
class Turn:
    id: str                     # UUID string, primary key
    conversation_id: str        # Foreign key
    sequence: int               # Auto-incrementing per conversation
    created_at: datetime
```

### Meeting (Transcript Source)

```python
class Meeting:
    id: int                     # Primary key
    doc_id: str                 # Unique identifier (indexed)
    title: str                  # Meeting title
    date: date                  # Meeting date
    formatted_content: str      # Full transcript text
    # ... additional metadata fields
```

---

## Potential Issues & Optimizations

### 1. Race Condition Risk
The frontend uses `isSendingRef.current` to prevent double-submit, but the `isLoading` state check at `useConversation.ts:59-63` could theoretically allow a fast double-click before state updates.

**Recommendation**: Consider using a mutex or debounce on the send button.

### 2. Token Budget Hardcoded
`MAX_DOCUMENT_TOKENS = 100,000` in `chat.py:47` is hardcoded. Context windows vary by model.

**Recommendation**: Make this configurable per-model in the provider configuration.

### 3. Auto-Title Overwrites User Titles
The title is regenerated for first exchanges (`chat.py:402-419`), even if user manually titled the conversation before sending.

**Recommendation**: Check if title was user-set before auto-generating.

### 4. No Retry Logic for SSE
SSE streaming has no retry mechanism. If connection drops mid-stream, the partial response is lost.

**Recommendation**: Implement resumable streams or checkpoint-based recovery.

### 5. Mention Limit Hardcoded
Max 5 mentions hardcoded at `chat.py:76`.

**Recommendation**: Make this configurable via environment variable or settings.

### 6. Blocking Auto-Title Call
The `generate_title()` call at `chat.py:411` is synchronous and blocks the final SSE event.

**Recommendation**: Consider making it fire-and-forget with a separate endpoint for title polling, or use a background task.

---

## State Variables Summary

### Frontend State

| Variable | Location | Purpose |
|----------|----------|---------|
| `draft` | `page.tsx` via `useDraft` | Current input text |
| `mentions` | `page.tsx` | Array of MentionChip objects |
| `messages` | `useConversation` | Array of Message objects |
| `isLoading` | `useConversation` | Whether stream is active |
| `isThinking` | `useConversation` | Whether thinking indicator shows |
| `conversationId` | `page.tsx` from URL | Current conversation UUID |
| `conversations` | `useConversations` | Sidebar conversation list |

### Backend State (Per Request)

| Variable | Location | Purpose |
|----------|----------|---------|
| `conversation` | `chat.py` | Loaded conversation record |
| `turn` | `chat.py` | Created turn for this exchange |
| `tool_tracker` | `chat.py` | Tracks tool usage for turn |
| `assistant_response` | `chat.py` | Accumulated streaming content |
| `context` | `chat.py` | Built @mention context string |
| `sources` | `chat.py` | List of resolved sources |

---

*Last updated: January 2026*
