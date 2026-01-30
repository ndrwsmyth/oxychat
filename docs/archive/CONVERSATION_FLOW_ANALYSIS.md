# Conversation Flow Analysis: OxyChat

This document traces and documents the complete execution path for how conversations are stored, managed, and saved in OxyChat, and how users interact with them.

---

## 1. Flow Summary

OxyChat uses a three-tier architecture for conversation management: a Next.js frontend with React hooks for state management, a FastAPI backend providing RESTful endpoints, and a PostgreSQL database (Supabase) with async SQLAlchemy ORM. The frontend maintains conversation state through URL-based routing (`?c={conversationId}`) and three specialized hooks: `useConversations` for the sidebar list, `useConversation` for active chat state, and `useDraft` for autosaving composer content.

When a user interacts with conversations, the frontend makes API calls to the backend, which performs database operations through async SQLAlchemy sessions. The system uses soft deletes for conversations, turn-based grouping for message pairs, and optimistic UI updates with server refresh. Authentication exists but is disabled in development mode, defaulting to a `dev-user-local` identifier.

Messages are created through a separate streaming endpoint (`/api/chat/stream`) that groups user and assistant messages into "turns" for logical organization. The conversation's `updated_at` timestamp is updated after each message exchange, enabling the sidebar to show conversations in chronological order with groupings (Today, Yesterday, Last 7 Days, etc.).

---

## 2. Detailed Step-by-Step Trace

### CREATE Conversation Flow

```
USER ACTION: Click "New chat" button
│
├─► FRONTEND: ConversationSidebar.tsx
│   └─► handleNewChat() → page.tsx:handleNewChat()
│
├─► HOOK: useConversations.createConversation("New conversation")
│   └─► frontend/src/hooks/useConversations.ts:43-48
│
├─► API CLIENT: apiCreateConversation(title)
│   └─► frontend/src/lib/api.ts:291-309
│   └─► POST /api/conversations
│   └─► Body: { title: "New conversation", model: "claude-sonnet-4.5" }
│
├─► BACKEND ROUTER: create_conversation()
│   └─► backend/app/routers/conversations.py:144-164
│   └─► Auth: get_optional_user (returns user_id or "dev-user-local")
│
├─► DATABASE: SQLAlchemy INSERT
│   └─► Conversation(id=uuid4(), title, model, auto_titled=False, pinned=False)
│   └─► await db.commit(); await db.refresh(conversation)
│
├─► RESPONSE: ConversationResponse { id, title, created_at, ... }
│
├─► REFRESH: loadConversations() → GET /api/conversations
│
└─► NAVIGATE: router.push(`/?c=${newConv.id}`)
```

### LOAD Messages Flow

```
URL CHANGE: ?c={conversationId}
│
├─► FRONTEND: page.tsx extracts conversationId from useSearchParams()
│   └─► frontend/src/app/page.tsx:24
│
├─► HOOK EFFECT: useConversation detects conversationId change
│   └─► frontend/src/hooks/useConversation.ts:27-38
│
├─► LOAD: loadMessages() called
│   └─► Skip if isSendingRef.current === true (prevents reload during send)
│
├─► API CLIENT: fetchMessages(conversationId)
│   └─► frontend/src/lib/api.ts:367-382
│   └─► GET /api/conversations/{id}/messages
│
├─► BACKEND ROUTER: get_messages()
│   └─► backend/app/routers/conversations.py:279-304
│
├─► DATABASE: SQLAlchemy SELECT
│   └─► Verify: select(Conversation).where(id == conv_id, deleted_at.is_(None))
│   └─► Query: select(Message).where(conversation_id == conv_id).order_by(created_at.asc())
│
├─► RESPONSE: list[MessageResponse]
│
└─► STATE UPDATE: setMessages(msgs) → OxyMessageThread renders
```

### SEND Message Flow (Streaming)

```
USER ACTION: Type message, click send
│
├─► FRONTEND: OxyComposer → onSend callback
│   └─► frontend/src/components/chat/OxyComposer.tsx
│
├─► HOOK: useConversation.sendMessage(content, mentions)
│   └─► frontend/src/hooks/useConversation.ts:54-120
│   └─► Sets isSendingRef.current = true
│
├─► API CLIENT: streamChat({ conversationId, messages, model, mentions })
│   └─► frontend/src/lib/api.ts:80-150
│   └─► POST /api/chat/stream (EventSource SSE)
│
├─► BACKEND ROUTER: stream_chat()
│   └─► backend/app/routers/chat.py:135-430
│
├─► CONTEXT INJECTION: resolve @mentions
│   └─► build_context_from_mentions() → fetch transcript content
│   └─► backend/app/converters.py
│
├─► DATABASE: Create Turn
│   └─► Get next sequence: select(Turn).order_by(sequence.desc()).limit(1)
│   └─► Insert: Turn(id=uuid4(), conversation_id, sequence)
│
├─► DATABASE: Save User Message
│   └─► Message(conversation_id, role="user", content, mentions, turn_id)
│
├─► LLM: Call OpenAI/Anthropic API (streaming)
│   └─► backend/app/services/chat_service.py
│
├─► SSE STREAM: yield data: {"type": "content", "content": "..."}\n\n
│   └─► Frontend accumulates chunks in assistant message
│
├─► DATABASE: Save Assistant Message (after stream completes)
│   └─► Message(conversation_id, role="assistant", content, model, turn_id)
│   └─► conversation.updated_at = datetime.now()
│
├─► AUTO-TITLE: If message_count == 2 and not auto_titled
│   └─► generate_title() via LLM → update conversation.title
│
└─► FRONTEND: setIsLoading(false), loadMessages() refresh
```

### UPDATE Conversation (Title Edit)

```
USER ACTION: Click conversation title in sidebar → edit → save
│
├─► FRONTEND: ConversationItem.tsx
│   └─► handleTitleClick() → isEditing = true
│   └─► handleTitleSave() on blur/Enter
│
├─► HOOK: useConversations.updateConversation(id, { title })
│   └─► frontend/src/hooks/useConversations.ts:50-57
│
├─► API CLIENT: apiUpdateConversation(id, { title })
│   └─► frontend/src/lib/api.ts:311-333
│   └─► PATCH /api/conversations/{id}
│
├─► BACKEND ROUTER: update_conversation()
│   └─► backend/app/routers/conversations.py:189-222
│
├─► DATABASE: SQLAlchemy UPDATE
│   └─► conversation.title = new_title
│   └─► conversation.updated_at = datetime.now(utc)
│   └─► await db.commit()
│
└─► REFRESH: loadConversations() → sidebar updates
```

### DELETE Conversation (Soft Delete)

```
USER ACTION: Hover conversation → click trash → confirm
│
├─► FRONTEND: ConversationItem.tsx
│   └─► handleDeleteClick() → shows confirmation
│   └─► handleDeleteConfirm()
│
├─► HOOK: useConversations.deleteConversation(id)
│   └─► frontend/src/hooks/useConversations.ts:59-63
│
├─► API CLIENT: apiDeleteConversation(id)
│   └─► frontend/src/lib/api.ts:335-345
│   └─► DELETE /api/conversations/{id}
│
├─► BACKEND ROUTER: delete_conversation()
│   └─► backend/app/routers/conversations.py:225-247
│
├─► DATABASE: SQLAlchemy UPDATE (Soft Delete)
│   └─► conversation.deleted_at = datetime.now(utc)
│   └─► await db.commit()
│
└─► REFRESH: loadConversations() → removed from sidebar
```

---

## 3. Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND (Next.js)                                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌──────────────────┐    ┌─────────────────────┐    ┌─────────────────────────────┐     │
│  │     page.tsx     │    │  ConversationSidebar│    │      OxyComposer            │     │
│  │  URL: ?c={id}    │◄──►│  - list view        │    │  - message input            │     │
│  │  - orchestrates  │    │  - new chat btn     │    │  - @mentions                │     │
│  └────────┬─────────┘    └──────────┬──────────┘    └─────────────┬───────────────┘     │
│           │                         │                              │                     │
│           ▼                         ▼                              ▼                     │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                              REACT HOOKS                                          │   │
│  │  ┌──────────────────┐  ┌────────────────────┐  ┌──────────────────────────────┐  │   │
│  │  │ useConversation  │  │ useConversations   │  │        useDraft              │  │   │
│  │  │ - messages[]     │  │ - grouped list     │  │ - autosave (500ms debounce)  │  │   │
│  │  │ - sendMessage()  │  │ - CRUD operations  │  │ - load/save/delete           │  │   │
│  │  │ - loadMessages() │  │ - togglePin()      │  └──────────────────────────────┘  │   │
│  │  └────────┬─────────┘  └──────────┬─────────┘                                    │   │
│  └───────────┼───────────────────────┼──────────────────────────────────────────────┘   │
│              │                       │                                                   │
│              ▼                       ▼                                                   │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            api.ts (API Client)                                    │   │
│  │  streamChat()  fetchConversations()  createConversation()  updateConversation()  │   │
│  │  fetchMessages()  deleteConversation()  togglePinConversation()  autoTitle()     │   │
│  │  fetchDraft()  saveDraft()  deleteDraft()                                        │   │
│  └──────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                               │
└──────────────────────────────────────────┼───────────────────────────────────────────────┘
                                           │ HTTP/SSE
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BACKEND (FastAPI)                                     │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐    │
│  │                               main.py (App Entry)                                │    │
│  │  - CORS middleware                                                               │    │
│  │  - Router registration: chat_router, conversations_router                        │    │
│  │  - Startup: init_db()                                                            │    │
│  └─────────────────────────────────────────────────────────────────────────────────┘    │
│                     │                              │                                     │
│                     ▼                              ▼                                     │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────────────────┐   │
│  │    routers/chat.py              │  │    routers/conversations.py                 │   │
│  │    POST /api/chat/stream        │  │    GET    /api/conversations                │   │
│  │    - @mention resolution        │  │    POST   /api/conversations                │   │
│  │    - Turn creation              │  │    GET    /api/conversations/{id}           │   │
│  │    - Message save               │  │    PATCH  /api/conversations/{id}           │   │
│  │    - LLM streaming              │  │    DELETE /api/conversations/{id}           │   │
│  │    - Auto-title trigger         │  │    POST   /api/conversations/{id}/pin       │   │
│  └──────────────┬──────────────────┘  │    GET    /api/conversations/{id}/messages  │   │
│                 │                     │    GET/PUT/DELETE .../draft                 │   │
│                 │                     │    POST   .../auto-title                    │   │
│                 │                     └────────────────────┬────────────────────────┘   │
│                 │                                          │                            │
│                 ▼                                          ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                            services/                                             │   │
│  │  chat_service.py (LLM calls)    auto_title.py (title generation)                │   │
│  │  vector_store.py (RAG)          tool_tracker.py (observability)                 │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
│                                          ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                          database.py (SQLAlchemy)                                │   │
│  │  async_sessionmaker  get_db() dependency  init_db()                             │   │
│  └─────────────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                              │
└──────────────────────────────────────────┼──────────────────────────────────────────────┘
                                           │ asyncpg
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE (Supabase PostgreSQL)                              │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ┌────────────────────────────┐     ┌────────────────────────────────────────────────┐  │
│  │       conversations        │     │                  messages                      │  │
│  │  ─────────────────────────│     │  ────────────────────────────────────────────  │  │
│  │  id          UUID (PK)     │◄────┤  id               UUID (PK)                    │  │
│  │  title       VARCHAR(500)  │     │  conversation_id  UUID (FK) ─────────────────►│  │
│  │  auto_titled BOOLEAN       │     │  turn_id          VARCHAR(36)                  │  │
│  │  model       VARCHAR(100)  │     │  role             VARCHAR(20)                  │  │
│  │  pinned      BOOLEAN       │     │  content          TEXT                         │  │
│  │  pinned_at   TIMESTAMPTZ   │     │  model            VARCHAR(100)                 │  │
│  │  created_at  TIMESTAMPTZ   │     │  mentions         JSON                         │  │
│  │  updated_at  TIMESTAMPTZ   │     │  created_at       TIMESTAMPTZ                  │  │
│  │  deleted_at  TIMESTAMPTZ   │     │  content_tsv      TSVECTOR (FTS)               │  │
│  │  title_tsv   TSVECTOR      │     └────────────────────────────────────────────────┘  │
│  └────────────────────────────┘                                                         │
│                                                                                          │
│  ┌────────────────────────────┐     ┌────────────────────────────────────────────────┐  │
│  │   conversation_drafts      │     │                   turns                        │  │
│  │  ─────────────────────────│     │  ────────────────────────────────────────────  │  │
│  │  conversation_id UUID (PK) │     │  id               VARCHAR(36) (PK)             │  │
│  │  content         TEXT      │     │  conversation_id  VARCHAR(36)                  │  │
│  │  updated_at      TIMESTAMP │     │  sequence         INTEGER                      │  │
│  └────────────────────────────┘     │  UNIQUE(conversation_id, sequence)             │  │
│                                      └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Key Files List

| File | Role | Key Functions |
|------|------|---------------|
| **Frontend** | | |
| `frontend/src/app/page.tsx` | Main orchestrator | Extracts `conversationId` from URL, coordinates all hooks |
| `frontend/src/hooks/useConversation.ts` | Active chat state | `loadMessages()`, `sendMessage()`, `stopGenerating()` |
| `frontend/src/hooks/useConversations.ts` | Sidebar list CRUD | `createConversation()`, `updateConversation()`, `deleteConversation()`, `togglePin()` |
| `frontend/src/hooks/useDraft.ts` | Draft autosave | Auto-loads/saves with 500ms debounce |
| `frontend/src/lib/api.ts` | HTTP client | All fetch functions, SSE streaming parser |
| `frontend/src/components/sidebar/ConversationSidebar.tsx` | Sidebar UI | Renders grouped conversations, new chat button |
| `frontend/src/components/sidebar/ConversationItem.tsx` | Single item UI | Click, edit, delete, pin handlers |
| `frontend/src/components/chat/OxyComposer.tsx` | Message input | @mention detection, send handler |
| **Backend** | | |
| `backend/app/main.py` | FastAPI entry | Router registration, CORS, startup init |
| `backend/app/routers/conversations.py` | Conversation API | All CRUD endpoints, draft operations |
| `backend/app/routers/chat.py` | Chat streaming API | `/api/chat/stream`, message persistence, auto-title |
| `backend/app/database.py` | ORM models | `Conversation`, `Message`, `Turn`, `ConversationDraft`, session factory |
| `backend/app/auth.py` | Authentication | `get_optional_user()`, JWT validation (disabled in dev) |
| `backend/app/services/auto_title.py` | Title generation | LLM-based conversation titling |
| `backend/app/converters.py` | @mention resolver | Maps doc_ids to transcript content |

---

## 5. API Endpoints Reference

### Conversation Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/api/conversations` | `list_conversations` | List all conversations grouped by date |
| `POST` | `/api/conversations` | `create_conversation` | Create a new conversation |
| `GET` | `/api/conversations/{id}` | `get_conversation` | Get a single conversation |
| `PATCH` | `/api/conversations/{id}` | `update_conversation` | Update conversation (title, model, pinned) |
| `DELETE` | `/api/conversations/{id}` | `delete_conversation` | Soft delete a conversation |
| `POST` | `/api/conversations/{id}/pin` | `toggle_pin_conversation` | Toggle pin status |
| `GET` | `/api/conversations/{id}/messages` | `get_messages` | Get all messages for a conversation |
| `GET` | `/api/conversations/{id}/draft` | `get_draft` | Get draft content |
| `PUT` | `/api/conversations/{id}/draft` | `save_draft` | Save/update draft content |
| `DELETE` | `/api/conversations/{id}/draft` | `delete_draft` | Delete draft |
| `POST` | `/api/conversations/{id}/auto-title` | `auto_title_conversation` | Generate automatic title |

### Chat Endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `POST` | `/api/chat/stream` | `stream_chat` | Stream chat response with SSE |

---

## 6. Database Schema

### conversations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `title` | VARCHAR(500) | NOT NULL, indexed | Conversation title |
| `auto_titled` | BOOLEAN | default=False | Whether title was auto-generated |
| `model` | VARCHAR(100) | default="claude-sonnet-4.5" | LLM model used |
| `pinned` | BOOLEAN | default=False | Pinned status |
| `pinned_at` | TIMESTAMPTZ | nullable | Timestamp when pinned |
| `created_at` | TIMESTAMPTZ | NOT NULL, auto | Creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL, auto | Last update timestamp |
| `deleted_at` | TIMESTAMPTZ | nullable | Soft delete timestamp |
| `title_tsv` | TSVECTOR | GIN indexed | Full-text search vector |

### messages

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PK, auto-generated | Unique identifier |
| `conversation_id` | UUID | FK, indexed | Reference to conversation |
| `turn_id` | VARCHAR(36) | nullable, indexed | Links to Turn |
| `role` | VARCHAR(20) | NOT NULL | "user" or "assistant" |
| `content` | TEXT | NOT NULL | Message content |
| `model` | VARCHAR(100) | nullable | Model used (assistant only) |
| `mentions` | JSON | default=[] | Array of @mention doc_ids |
| `created_at` | TIMESTAMPTZ | NOT NULL | Timestamp |
| `content_tsv` | TSVECTOR | GIN indexed | Full-text search vector |

### conversation_drafts

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `conversation_id` | UUID | PK | Reference to conversation |
| `content` | TEXT | NOT NULL | Draft content |
| `updated_at` | TIMESTAMPTZ | NOT NULL | Last update timestamp |

### turns

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | VARCHAR(36) | PK | Unique identifier |
| `conversation_id` | VARCHAR(36) | indexed | Reference to conversation |
| `sequence` | INTEGER | | Order within conversation |
| | | UNIQUE(conversation_id, sequence) | |

---

## 7. Frontend State Management

### Hook Dependencies

```
page.tsx
├── useConversations()     → Sidebar conversation list
│   └── Manages: GroupedConversations state
│   └── Operations: create, update, delete, togglePin, search
│
├── useConversation(conversationId, transcripts)
│   └── Manages: messages[], model, isLoading, isThinking
│   └── Operations: loadMessages, sendMessage, stopGenerating
│
└── useDraft(conversationId)
    └── Manages: draft string, isSaving
    └── Operations: autosave with 500ms debounce
```

### URL-Based Routing

- Conversation ID stored in URL: `?c={conversationId}`
- Enables shareable links and browser history navigation
- Extracted via `useSearchParams()` hook

### Data Flow Pattern

1. User types message in `OxyComposer`
2. `useDraft` debounces and saves to `/api/conversations/:id/draft`
3. User clicks send
4. `useConversation.sendMessage()` streams response via SSE
5. After complete exchange, backend auto-titles if first message
6. Frontend calls `loadConversations()` to refresh sidebar

---

## 8. Potential Issues and Optimizations

### Issues Found

1. **User isolation disabled**: The `user_id` column exists in migrations but ownership checks are commented out. All conversations are visible to all users in dev mode.

2. **Model/migration mismatch**: Migration files added columns (`user_id`, `parent_message_id`, `version`) that are not in the SQLAlchemy models, creating potential runtime errors.

3. **Type inconsistency**: `Turn.conversation_id` uses `String(36)` while `Conversation.id` uses `UUID`. This forces string conversions and prevents proper foreign key constraints.

4. **No transaction boundaries**: Multi-step operations (create turn + user message + assistant message) lack explicit transaction scoping - failures could leave partial data.

5. **Refresh-after-mutation pattern**: Every mutation triggers a full `loadConversations()` reload. With many conversations, this becomes expensive.

6. **Missing cascades**: No cascade delete defined - deleting a conversation leaves orphaned messages and drafts (mitigated by soft delete, but cleanup queries needed).

### Optimization Opportunities

1. **Optimistic updates with reconciliation**: Update UI immediately, reconcile with server response instead of full refetch.

2. **Pagination for conversations**: The sidebar loads all conversations at once. Add cursor-based pagination for users with many chats.

3. **WebSocket for real-time sync**: Replace polling/refresh with WebSocket for multi-device sync and collaborative features.

4. **Batch message save**: Combine turn creation and message saves into a single transaction with explicit `BEGIN/COMMIT`.

5. **Index optimization**: Add composite index on `(conversation_id, created_at)` for messages if not present (check migrations).

6. **Draft deduplication**: Current upsert pattern does SELECT then UPDATE/INSERT - use PostgreSQL `INSERT ... ON CONFLICT` for atomic upsert.

---

## 9. Authentication Flow (Development Mode)

Current state: Authentication is **disabled** for development.

```python
# backend/app/routers/conversations.py
DEFAULT_DEV_USER = "dev-user-local"

# All endpoints use:
user_id: str = Depends(get_optional_user)
# Returns actual user_id if token provided, else "dev-user-local"
```

### Production Considerations

- Enable `user_id` filtering in all queries
- Add `user_id` foreign key to `Conversation` model
- Implement proper JWT validation via Supabase
- Add row-level security (RLS) policies in PostgreSQL

---

*Document generated: January 2026*
*Last updated: Conversation flow analysis for OxyChat engineering team*
