# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# OxyChat

AI workspace platform for Oxy design agency. Context-aware AI that uses meeting transcripts as primary knowledge base. Transitioning from ChatKit-based Q&A tool to full workspace with custom UI.

## Project Architecture

### Monorepo Structure
- **Root**: Orchestrates both services via npm scripts
- **backend/**: FastAPI Python service (Python 3.11+)
- **frontend/**: Next.js React app (TypeScript, Tailwind, shadcn/ui)

### Backend Architecture (FastAPI)

**Core Services**:
- **app/main.py** - FastAPI entrypoint, registers routers, CORS, database init
- **app/routers/** - API route handlers organized by domain:
  - `chat.py` - Streaming chat with SSE, @mention context injection
  - `conversations.py` - CRUD for conversations, auto-titling, pinning
  - `transcripts.py` - List/search transcripts from DB or files
- **app/services/** - Business logic layer:
  - `chat_service.py` - OpenAI API integration, message formatting
  - `vector_store.py` - ChromaDB RAG for transcript search
  - `auto_title.py` - LLM-based conversation titling
- **app/database.py** - SQLAlchemy async ORM, Supabase PostgreSQL connection
  - Models: `Meeting` (transcripts), `Conversation`, `Message`, `Draft`
  - Handles both DB-stored and file-based transcripts

**Data Flow**:
1. CircleBack webhook → `webhook.py` → parse/store in Supabase → index in ChromaDB
2. User query → `chat.py` router → resolve @mentions from DB → inject context → stream LLM response
3. File-based transcripts in `raw_transcripts/` auto-loaded as `@doc_{slug}` mentions

**Key Patterns**:
- Async/await throughout (AsyncSession, async generators for SSE)
- @mentions converted to full transcript context via `converters.py`
- SSE streaming with `data: {json}\n\n` format for real-time responses
- Dual storage: Supabase (webhook data) + filesystem (markdown transcripts)

### Frontend Architecture (Next.js)

**App Structure** (App Router):
- **src/app/page.tsx** - Main chat interface, orchestrates all components
- **src/components/** - Organized by domain:
  - `layout/AppLayout.tsx` - Grid layout with collapsible sidebar
  - `sidebar/ConversationSidebar.tsx` - Conversation list with grouping (Today, Yesterday, etc.)
  - `chat/` - Core chat UI: OxyComposer, OxyMessageThread, OxyEmptyState
  - `library/OxyLibraryDrawer.tsx` - Transcript picker with search
  - `mentions/OxyMentionPopover.tsx` - @mention autocomplete

**State Management**:
- **src/hooks/** - Custom hooks for data and UI state:
  - `useConversation.ts` - Active conversation messages, streaming, model switching
  - `useConversations.ts` - Sidebar conversation list, CRUD operations
  - `useDraft.ts` - Autosave composer content to backend
  - `useTranscripts.ts` - Fetch/cache available transcripts
  - `useSidebar.ts` - Sidebar open/close state
- **src/lib/api.ts** - Centralized API client (fetch wrappers, SSE parsing)

**Data Flow**:
1. User types → `useDraft` debounces → saves to `/api/conversations/:id/draft`
2. User sends → `useConversation` → POST `/api/chat/stream` → parse SSE chunks → update UI
3. First message → auto-create conversation → auto-generate title via backend
4. @mention trigger → `OxyMentionPopover` → filter transcripts → insert into composer

**Key Patterns**:
- URL-based routing: `?c={conversationId}` for shareable links
- Optimistic updates for conversation list (pin, delete, rename)
- SSE streaming parsed in `streamChat()` with `data: [DONE]` termination
- shadcn/ui primitives for consistent styling (Dialog, Popover, ScrollArea)

## Development Commands

### Running the App

Start both services (requires `uv` and `OPENAI_API_KEY`):
```bash
npm start
```

Start individually:
```bash
# Backend only (from root)
npm run backend
# Or from backend/
cd backend && uv run uvicorn app.main:app --reload --port 8000

# Frontend only (from root)
npm run frontend
# Or from frontend/
cd frontend && npm run dev
```

Backend runs on `http://localhost:8000`, frontend on `http://localhost:3000`

### Environment Variables

Required:
- `OPENAI_API_KEY` - OpenAI API key for LLM calls
- `SUPABASE_DATABASE_URL` - PostgreSQL connection string (format: `postgresql+asyncpg://user:pass@host:5432/db`)

Optional:
- `NEXT_PUBLIC_API_URL` - Frontend API base URL (defaults to `http://localhost:8000`)

### Backend Development

```bash
# Install dependencies
cd backend && uv sync

# Run with auto-reload
uv run uvicorn app.main:app --reload --port 8000

# Lint/format
uv run ruff check app/
uv run ruff format app/

# Type check
uv run mypy app/
```

Database tables auto-create on startup via `init_db()` in `main.py`

### Frontend Development

```bash
# Install dependencies
cd frontend && npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

## Key Features Implementation

### @Mention System
- Frontend: `OxyMentionPopover` detects `@` trigger → shows transcript picker
- Backend: `parseMentions()` extracts doc IDs → `build_context_from_mentions()` fetches full transcripts → injected into system prompt
- Supports both DB transcripts (`doc_{meeting_id}`) and file transcripts (`doc_{slug}`)

### Conversation Persistence
- Auto-create conversation on first message with UUID
- Auto-title after first exchange via `auto_title.py` (summarizes user intent)
- Draft autosave every 500ms to backend for recovery
- Grouped sidebar: Pinned, Today, Yesterday, Last 7 Days, Last 30 Days, Older

### Streaming Responses
- Backend yields `data: {"type": "content", "content": "..."}\n\n` chunks
- Frontend `streamChat()` parses SSE → accumulates text → updates UI in real-time
- Handles `[DONE]` termination and error propagation

### RAG (Phase 1D - Planned)
- `vector_store.py` uses ChromaDB with OpenAI embeddings
- Transcripts chunked and indexed on webhook ingestion
- Query embedding → cosine similarity search → inject top-k chunks as context
- Currently toggled off (`use_rag: false` default in frontend)

## Tech Stack

**Backend**:
- FastAPI 0.114+ - async Python web framework
- SQLAlchemy 2.0 - async ORM with asyncpg driver
- OpenAI SDK 1.40+ - LLM API calls
- ChromaDB 0.4+ - vector database for RAG
- Supabase PostgreSQL - primary data store

**Frontend**:
- Next.js 16 (App Router) - React framework
- TypeScript 5 - type safety
- Tailwind CSS 4 - utility-first styling
- shadcn/ui - accessible component primitives
- Radix UI - unstyled accessible components

**External Services**:
- OpenAI API - GPT-4/Claude models for chat
- Supabase - managed PostgreSQL database
- CircleBack - meeting transcript webhook source

## Important Notes

- **Frontend recently migrated** from Vite to Next.js (commit 1cb0487) - some legacy ChatKit references may remain
- **Database is optional** - app gracefully degrades if `SUPABASE_DATABASE_URL` unset (file transcripts only)
- **Raw markdown transcripts** in `backend/app/raw_transcripts/` auto-load with slug-based IDs
- **Model switching** supported via `ModelPicker` component (claude-sonnet-4.5, gpt-4, etc.)
- **API-first design** - backend is UI-agnostic, frontend is swappable
- **Human-in-the-loop** philosophy - agent outputs reviewed before final delivery (future feature)
