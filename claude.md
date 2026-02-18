# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# OxyChat

Internal AI workspace for Oxy design agency. Context-aware chat with meeting transcripts as primary knowledge base. Multi-model (Anthropic + OpenAI), multi-user (Google OAuth, @oxy.so domain).

Built on the **Sediment framework** — composable Tasks, full observability, effects-as-data.

## Project Architecture

### Monorepo Structure
- **Root**: Orchestrates both services via pnpm + concurrently
- **backend/**: Hono TypeScript service (Sediment framework)
- **frontend/**: Next.js 16 React app (TypeScript, Tailwind 4, shadcn/ui)

### Backend Architecture (Hono + Sediment)

**Entrypoint**: `src/index.ts` — Hono app with CORS, health check, auth middleware, route mounting. Port 8000.

**Routes** (`src/routes/`):
- `conversations.ts` — CRUD, pin toggle, date-grouped list
- `chat.ts` — `POST /api/conversations/:id/messages` → SSE streaming via Sediment ChatPipelineTask
- `transcripts.ts` — List/search for @mention autocomplete

**Sediment Tasks** (`src/tasks/`):
- `chat-pipeline.ts` — Layer 3 orchestrator: parse → load → save user msg → stream LLM → save assistant msg → auto-title
- `chat-agent.ts` — Layer 2: builds prompt with system + conversation history + @mention context, streams via CompletionsAdapter
- `load-conversation.ts` — Fetches conversation + message history from Supabase
- `parse-input.ts` — Extracts @mention IDs from frontend payload
- `save-message.ts` — Persists user/assistant messages
- `update-conversation.ts` — Updates timestamp, auto-titles via LLM if no title exists

**Core Lib** (`src/lib/`):
- `runtime.ts` — Sediment Runtime factory. Singleton Anthropic + OpenAI adapters. Creates per-request Runtime with CompositeLogger (console + SupabaseLogStore)
- `supabase.ts` — Singleton Supabase client (service role key)
- `constants.ts` — System prompt (XML-structured Oxy Agent persona), model configs, context limits

**Middleware** (`src/middleware/`):
- `auth.ts` — Validates Supabase JWT from `Authorization: Bearer` header, rejects non-@oxy.so emails, sets `c.get('user')`

**Adapters** (`src/adapters/`):
- `supabase-log-store.ts` — Sediment `Logger` interface → `completion_logs` table. Fire-and-forget inserts.

**Key Patterns**:
- All LLM calls go through Sediment's CompletionsAdapter (unified interface for Anthropic + OpenAI)
- SSE events: `token`, `title_update`, `done`, `error` — streamed via Hono's `streamSSE`
- Tasks are async generators using `defineTask` / `runTask` / `runTaskToCompletion` from Sediment
- Service-role Supabase client for all DB operations (no per-user RLS in backend — auth middleware handles access control)

### Frontend Architecture (Next.js)

**App Structure** (App Router):
- **src/app/page.tsx** — Main chat interface, orchestrates all components
- **src/components/** — Organized by domain:
  - `layout/AppLayout.tsx` — Grid layout with collapsible sidebar
  - `sidebar/ConversationSidebar.tsx` — Conversation list with grouping (Today, Yesterday, etc.)
  - `chat/` — Core chat UI: OxyComposer, OxyMessageThread, OxyEmptyState
  - `library/OxyLibraryDrawer.tsx` — Transcript picker with search
  - `mentions/OxyMentionPopover.tsx` — @mention autocomplete

**State Management**:
- **src/hooks/** — Custom hooks for data and UI state:
  - `useConversation.ts` — Active conversation messages, streaming, model switching
  - `useConversations.ts` — Sidebar conversation list, CRUD with optimistic updates
  - `useDraft.ts` — Stubbed out (draft autosave deferred)
  - `useTranscripts.ts` — Fetch/cache available transcripts
  - `useSidebar.ts` — Sidebar open/close state
- **src/lib/api.ts** — Centralized API client (fetch wrappers, SSE parsing, auth headers from Supabase session)

**Data Flow**:
1. User sends → `useConversation` → POST `/api/conversations/:id/messages` → parse SSE chunks → update UI
2. First message → auto-create conversation → backend auto-titles via SSE `title_update` event
3. @mention trigger → `OxyMentionPopover` → filter transcripts → insert chip into composer → IDs sent with message

**Key Patterns**:
- URL-based routing: `?c={conversationId}` for shareable links
- Optimistic updates for conversation list (pin, delete, rename)
- SSE parser handles both `token` and `content` event types (backward compat)
- `[DONE]` termination signal
- shadcn/ui primitives for consistent styling (Dialog, Popover, ScrollArea)

### Database (Supabase PostgreSQL)

Schema defined in `backend/schema.sql`. Key tables:
- `user_profiles` — extends Supabase auth.users
- `conversations` — with model, pinned, soft delete (deleted_at)
- `messages` — with citations JSONB, mentions JSONB, model, token_count
- `transcripts` — with tsvector full-text search on title
- `transcript_chunks` — with pgvector embeddings (for future RAG)
- `completion_logs` — Sediment CompletionRecord storage
- `effects` — Sediment effect store

Extensions: `pgvector`, `pg_trgm`. RLS enabled on all tables.

## Development Commands

### Running the App

Start both services:
```bash
pnpm start
```

Start individually:
```bash
# Backend (from root)
pnpm run backend
# Or from backend/
cd backend && pnpm run dev

# Frontend (from root)
pnpm run frontend
# Or from frontend/
cd frontend && pnpm run dev
```

Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`

### Environment Variables

**Backend** (in `backend/.env`):
- `SUPABASE_URL` — Supabase project URL (required)
- `SUPABASE_SERVICE_KEY` — Supabase service role key (required)
- `ANTHROPIC_API_KEY` — Anthropic API key (required for Claude models)
- `OPENAI_API_KEY` — OpenAI API key (required for GPT models)
- `PORT` — Server port (default: 8000)
- `NODE_ENV` — development | production

**Frontend** (in `frontend/.env.local`):
- `NEXT_PUBLIC_API_URL` — Backend URL (default: `http://localhost:8000`)
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key

### Backend Development

```bash
cd backend

# Install dependencies
pnpm install

# Dev server with auto-reload
pnpm run dev

# Type check
pnpm run lint

# Build for production
pnpm run build

# Run tests
pnpm test
```

### Frontend Development

```bash
cd frontend

# Install dependencies
pnpm install

# Dev server
pnpm run dev

# Build for production
pnpm run build

# Lint
pnpm run lint

# Tests
pnpm test
```

## Sediment Framework

Private package installed from `github:ndrwsmyth/sediment`. Key APIs used in this project:

```typescript
// Core
import { defineTask, runTask, runTaskToCompletion, completionTask, Runtime } from '@ndrwsmyth/sediment';

// Adapters
import { createAnthropicAdapter, createOpenAIAdapter } from '@ndrwsmyth/sediment';

// Logging
import { ConsoleLogger, CompositeLogger } from '@ndrwsmyth/sediment';

// Types
import type { CompletionsAdapterInterface, Logger, CompletionRecordInterface, RuntimeDeps } from '@ndrwsmyth/sediment';
```

**Task pattern**: Every task is an async generator defined with `defineTask<Input, Output>`. Tasks receive `RuntimeDeps` (completions adapter, logger, etc.) and yield outputs. Higher-layer tasks call lower-layer tasks via `runTask`/`runTaskToCompletion`.

**Model routing**: `lib/runtime.ts` maps friendly model names (e.g., `claude-opus-4.5`) to provider-specific IDs (e.g., `claude-opus-4-5-20251101`) and routes to the correct adapter.

## Supported Models

| Frontend Key | Provider | Model ID |
|---|---|---|
| `claude-opus-4.5` | Anthropic | `claude-opus-4-5-20251101` |
| `claude-sonnet-4.5` | Anthropic | `claude-sonnet-4-5-20250929` |
| `gpt-5.2` | OpenAI | `gpt-5.2` |
| `grok-4` | OpenAI | `grok-4` |

Default model: `gpt-5.2`

## Tech Stack

**Backend**: Hono, TypeScript, Sediment, @supabase/supabase-js, @anthropic-ai/sdk, openai, zod
**Frontend**: Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, Radix UI, Supabase Auth
**Database**: Supabase PostgreSQL + pgvector + pg_trgm
**Deployment**: Railway (backend Docker container), Vercel-compatible (frontend)

## Phase Status

- **Phase 1: Foundation** ✅ — Hono backend, Supabase schema, auth, Sediment runtime, chat streaming, conversation CRUD, @mentions, frontend updated
- **Phase 2: Transcript Ingestion** — Webhook endpoint, chunking, embeddings (not started)
- **Phase 3+: RAG/Hybrid Search** — Vector + BM25 search, reranking (not started)
- **File Attachments** — Upload, parse, context injection (not started)

---

## Claude Code Workflow

### Verification Commands

Always verify changes work before considering a task complete:

```bash
# Backend verification
cd backend && pnpm run lint

# Frontend verification
cd frontend && pnpm run lint && pnpm run build

# Run tests if they exist
cd backend && pnpm test
cd frontend && pnpm test
```

### Code Style

**TypeScript (backend)**:
- Use Sediment's `defineTask` / `runTask` patterns for all LLM orchestration
- Hono route handlers should be thin — delegate to Sediment tasks
- Use `getSupabase()` singleton for all DB operations
- SSE responses use `streamSSE` from Hono with `data: {json}` format + `[DONE]` termination
- All imports use `.js` extensions (Node16 module resolution)

**TypeScript (frontend)**:
- Use named exports, not default exports
- Hooks go in `src/hooks/`, API calls in `src/lib/api.ts`
- shadcn/ui components for UI primitives — don't reinvent
- Tailwind for styling — avoid inline styles or CSS modules

### Common Gotchas

- **SSE streaming**: Frontend handles both `token` and `content` event types — backend sends `token`
- **Auth**: Backend validates Supabase JWT and restricts to @oxy.so emails. Frontend sends `Authorization: Bearer` header via `getAuthHeaders()`
- **Model IDs**: Frontend uses friendly names (`claude-opus-4.5`), backend maps to provider IDs (`claude-opus-4-5-20251101`) in `lib/runtime.ts`
- **Environment variables**: Backend reads from env directly, frontend uses `NEXT_PUBLIC_` prefix
- **CORS**: Backend allows all origins in dev — don't commit restrictive CORS for production without updating deployment config
- **Sediment Logger**: `SupabaseLogStore` implements the full `Logger` interface (log, getRecords, getByRequestId, logTool, getToolRecords, getToolRecordsByRequestId, clear)
- **Draft autosave**: Currently stubbed out on frontend — `useDraft.ts` and api.ts draft functions are no-ops

### Repeat Mistakes to Avoid

**Accessibility (fixed 3+ times)**:
- Radix `Dialog` components MUST have `DialogTitle` (use `className="sr-only"` if visually hidden)
- Interactive elements need `aria-label` when icon-only
- Buttons in custom components need `tabIndex={0}` and `onKeyDown` handlers for Enter/Space
- Loading states need `role="status"` and `aria-label`

**CSS Design Tokens (fixed 47+ hardcoded values)**:
- NEVER use raw pixel values — use `var(--spacing-*)`, `var(--size-*)`, etc.
- NEVER use raw colors — use `var(--gray-*)`, `var(--blue-*)`, etc.
- Check `globals.css` for existing tokens before adding new ones
- Both light and dark mode tokens must be defined

**@Mention System (multiple critical bugs)**:
- The composer uses DOM manipulation for mention pills — test insertion/deletion thoroughly
- Watch for duplication bugs when inserting mentions
- Mention IDs are transcript UUIDs sent as array from frontend

**Radix UI Components**:
- `Dialog` → requires `DialogTitle`
- `AlertDialog` → requires `AlertDialogTitle` and `AlertDialogDescription`
- `Popover` → check keyboard navigation works
- Always test with keyboard-only navigation

**Sediment Integration**:
- `CompletionRecordInterface` uses `context?.productName`, NOT `productName` at top level
- `Logger` interface requires `getByRequestId`, `getToolRecordsByRequestId`, and `clear` methods
- `completionTask` requires a typed input parameter — cannot pass `undefined`
- Always use `Runtime.create()` then `runtime.getDeps()` — never construct deps manually
