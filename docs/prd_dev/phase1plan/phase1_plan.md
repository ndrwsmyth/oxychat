│ Plan to implement                                                                                  │
│                                                                                                    │
│ OxyChat Backend Rebuild Plan — Phase 1: Foundation                                                 │
│                                                                                                    │
│ Summary                                                                                            │
│                                                                                                    │
│ Delete the entire Python/FastAPI backend. Replace it with a TypeScript/Hono backend powered by the │
│  Sediment framework. Nuke the existing Supabase schema and rebuild from the PRD. Update the        │
│ frontend API client to match the new contracts.                                                    │
│                                                                                                    │
│ ---                                                                                                │
│ Decisions Made (from interview)                                                                    │
│ ┌──────────────────────┬───────────────────────────────────────────────────────────┐               │
│ │       Decision       │                          Choice                           │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Server framework     │ Hono (TypeScript, Web Standards, first-class SSE)         │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Backend architecture │ Standalone Node service (not Next.js API routes)          │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Sediment source      │ Private GitHub package (github:ndrwsmyth/sediment#v0.1.0) │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Supabase             │ Nuke existing — wipe all tables, rebuild from scratch     │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ LLM providers        │ Both Anthropic + OpenAI from day one                      │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ API contract         │ Match PRD spec — update frontend to match                 │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Logging              │ Supabase LogStore from day one                            │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ DB connections       │ App-level pool (singleton Supabase client)                │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Transition           │ App goes offline until chat works                         │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Legacy transcripts   │ Drop file-based transcripts — DB only going forward       │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Frontend             │ Include in plan — update hooks/api.ts for new contracts   │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Deployment           │ Railway (container deploy)                                │               │
│ ├──────────────────────┼───────────────────────────────────────────────────────────┤               │
│ │ Schema setup         │ Single SQL file for Supabase SQL editor                   │               │
│ └──────────────────────┴───────────────────────────────────────────────────────────┘               │
│ ---                                                                                                │
│ Phase 1 Scope (Foundation)                                                                         │
│                                                                                                    │
│ What we're building:                                                                               │
│ 1. New TypeScript backend with Hono                                                                │
│ 2. New Supabase schema (users, conversations, messages, transcripts, completion_logs, effects)     │
│ 3. Google OAuth with @oxy.so domain restriction                                                    │
│ 4. Sediment Runtime wired up with Anthropic + OpenAI adapters                                      │
│ 5. SupabaseLogStore (CompletionRecords to DB)                                                      │
│ 6. Core chat streaming (SSE) via Sediment ChatPipelineTask                                         │
│ 7. Conversation CRUD endpoints                                                                     │
│ 8. @mention parsing and transcript context injection                                               │
│ 9. Frontend API client updated to match new backend                                                │
│                                                                                                    │
│ What we're NOT building in Phase 1:                                                                │
│ - RAG/hybrid search (Phase 2+)                                                                     │
│ - File attachments (Phase 2+)                                                                      │
│ - Webhook ingestion pipeline (Phase 2)                                                             │
│ - Transcript CRUD endpoints (Phase 2)                                                              │
│ - Draft autosave (defer — low priority)                                                            │
│                                                                                                    │
│ ---                                                                                                │
│ Step-by-Step Implementation                                                                        │
│                                                                                                    │
│ Step 1: Nuke existing backend                                                                      │
│                                                                                                    │
│ Action: Delete the entire backend/ directory contents and reinitialize as a TypeScript project.    │
│                                                                                                    │
│ # Delete Python backend                                                                            │
│ rm -rf backend/                                                                                    │
│                                                                                                    │
│ # Create new TypeScript backend                                                                    │
│ mkdir -p backend/src/{routes,tasks,adapters,middleware,lib}                                        │
│ cd backend && pnpm init                                                                            │
│                                                                                                    │
│ Supabase nuke command (run in Supabase SQL Editor):                                                │
│ -- Drop all custom tables (order matters for FK constraints)                                       │
│ DROP TABLE IF EXISTS effects CASCADE;                                                              │
│ DROP TABLE IF EXISTS completion_logs CASCADE;                                                      │
│ DROP TABLE IF EXISTS retrieval_results CASCADE;                                                    │
│ DROP TABLE IF EXISTS agent_steps CASCADE;                                                          │
│ DROP TABLE IF EXISTS tool_calls CASCADE;                                                           │
│ DROP TABLE IF EXISTS conversation_drafts CASCADE;                                                  │
│ DROP TABLE IF EXISTS messages CASCADE;                                                             │
│ DROP TABLE IF EXISTS turns CASCADE;                                                                │
│ DROP TABLE IF EXISTS conversations CASCADE;                                                        │
│ DROP TABLE IF EXISTS meetings CASCADE;                                                             │
│ DROP TABLE IF EXISTS profiles CASCADE;                                                             │
│ DROP TABLE IF EXISTS transcript_chunks CASCADE;                                                    │
│ DROP TABLE IF EXISTS transcripts CASCADE;                                                          │
│ DROP TABLE IF EXISTS user_profiles CASCADE;                                                        │
│ DROP TABLE IF EXISTS attachments CASCADE;                                                          │
│                                                                                                    │
│ -- Drop functions                                                                                  │
│ DROP FUNCTION IF EXISTS hybrid_search CASCADE;                                                     │
│                                                                                                    │
│ -- Drop extensions (if not needed by other projects)                                               │
│ -- DROP EXTENSION IF EXISTS pg_trgm;                                                               │
│ -- DROP EXTENSION IF EXISTS vector;                                                                │
│                                                                                                    │
│ Step 2: Initialize TypeScript backend                                                              │
│                                                                                                    │
│ Files to create:                                                                                   │
│                                                                                                    │
│ backend/package.json:                                                                              │
│ - Dependencies: hono, @hono/node-server, @supabase/supabase-js, sediment (from GitHub), openai,    │
│ @anthropic-ai/sdk, dotenv, zod                                                                     │
│ - Dev: typescript, tsx, @types/node, vitest                                                        │
│ - Scripts: dev (tsx watch), build (tsc), start (node dist/index.js)                                │
│                                                                                                    │
│ backend/tsconfig.json:                                                                             │
│ - Target: ES2022, module: Node16, strict mode                                                      │
│ - Path alias: @/* -> ./src/*                                                                       │
│                                                                                                    │
│ backend/src/index.ts:                                                                              │
│ - Hono app with CORS, health check                                                                 │
│ - Listen on port 8000                                                                              │
│                                                                                                    │
│ Step 3: Create Supabase schema                                                                     │
│                                                                                                    │
│ File: backend/schema.sql                                                                           │
│                                                                                                    │
│ Creates all tables from the PRD (Section 4.1):                                                     │
│ - user_profiles — extends Supabase auth.users                                                      │
│ - conversations — with model, pinned, pinned_at fields (preserving frontend compatibility)         │
│ - messages — with citations JSONB, model, token_count                                              │
│ - transcripts — with title_search tsvector, source_id                                              │
│ - transcript_chunks — with embedding vector(1536), content_search tsvector                         │
│ - completion_logs — Sediment CompletionRecord storage                                              │
│ - effects — Sediment effect store                                                                  │
│ - attachments — (schema only, not wired up yet)                                                    │
│                                                                                                    │
│ Also creates:                                                                                      │
│ - Enable pgvector and pg_trgm extensions                                                           │
│ - All indexes from the PRD                                                                         │
│ - RLS policies                                                                                     │
│ - hybrid_search() function (for future use)                                                        │
│                                                                                                    │
│ Step 4: Auth middleware                                                                            │
│                                                                                                    │
│ File: backend/src/middleware/auth.ts                                                               │
│                                                                                                    │
│ - Validates Supabase JWT from Authorization: Bearer <token> header                                 │
│ - Extracts user ID and email                                                                       │
│ - Rejects non-@oxy.so emails                                                                       │
│ - Exposes c.get('user') in Hono context                                                            │
│                                                                                                    │
│ Step 5: Database client                                                                            │
│                                                                                                    │
│ File: backend/src/lib/supabase.ts                                                                  │
│                                                                                                    │
│ - Singleton Supabase client (app-level pool)                                                       │
│ - Service role key for backend operations                                                          │
│ - Helper functions for common queries                                                              │
│                                                                                                    │
│ Step 6: Sediment Runtime factory                                                                   │
│                                                                                                    │
│ File: backend/src/lib/runtime.ts                                                                   │
│                                                                                                    │
│ Verified model IDs (from official docs, January 2026):                                             │
│ - Claude Opus 4.5: claude-opus-4-5-20251101 (alias: claude-opus-4-5)                               │
│ - Claude Sonnet 4.5: claude-sonnet-4-5-20250929 (alias: claude-sonnet-4-5)                         │
│ - GPT-5.2: gpt-5.2                                                                                 │
│                                                                                                    │
│ import { Runtime } from 'sediment/core/runtime';                                                   │
│ import { createAnthropicAdapter } from 'sediment/adapters/completions/anthropic';                  │
│ import { createOpenAIAdapter } from 'sediment/adapters/completions/openai';                        │
│ import { createConsoleLogger, CompositeLogger } from 'sediment/logging';                           │
│ import { createEffectStore } from 'sediment/stores/effects';                                       │
│ import { createCitationStore } from 'sediment/stores/citations';                                   │
│ import { createToolsAdapter } from 'sediment/adapters/tools/interface';                            │
│ import type { CompletionsAdapterInterface } from 'sediment/core/types';                            │
│                                                                                                    │
│ const MODEL_CONFIG = {                                                                             │
│   'claude-opus-4-5': { provider: 'anthropic', id: 'claude-opus-4-5-20251101' },                    │
│   'claude-sonnet-4.5': { provider: 'anthropic', id: 'claude-sonnet-4-5-20250929' },                │
│   'gpt-5.2': { provider: 'openai', id: 'gpt-5.2' },                                                │
│ } as const;                                                                                        │
│                                                                                                    │
│ // Singleton adapters (reused across requests — both ship with Sediment)                           │
│ const anthropicAdapter = createAnthropicAdapter({                                                  │
│   apiKey: process.env.ANTHROPIC_API_KEY!,                                                          │
│   maxRetries: 3,                                                                                   │
│ });                                                                                                │
│                                                                                                    │
│ const openaiAdapter = createOpenAIAdapter({                                                        │
│   apiKey: process.env.OPENAI_API_KEY!,                                                             │
│   maxRetries: 3,                                                                                   │
│ });                                                                                                │
│                                                                                                    │
│ function getAdapterForModel(model: string): CompletionsAdapterInterface {                          │
│   const config = MODEL_CONFIG[model as keyof typeof MODEL_CONFIG];                                 │
│   if (!config) throw new Error(`Unknown model: ${model}`);                                         │
│   return config.provider === 'anthropic' ? anthropicAdapter : openaiAdapter;                       │
│ }                                                                                                  │
│                                                                                                    │
│ export function createChatRuntime(opts: {                                                          │
│   model: string;                                                                                   │
│   userId: string;                                                                                  │
│   conversationId: string;                                                                          │
│ }) {                                                                                               │
│   const logger = new CompositeLogger([                                                             │
│     createConsoleLogger({ verbose: false }),                                                       │
│     supabaseLogStore, // from Step 7                                                               │
│   ]);                                                                                              │
│                                                                                                    │
│   return Runtime.create({                                                                          │
│     completions: getAdapterForModel(opts.model),                                                   │
│     tools: createToolsAdapter(), // tools registered per-request                                   │
│     effects: createEffectStore(),                                                                  │
│     citations: createCitationStore(),                                                              │
│     logger,                                                                                        │
│     productName: 'oxychat',                                                                        │
│     productStep: 'chat_pipeline',                                                                  │
│     requestId: crypto.randomUUID(),                                                                │
│     environment: (process.env.NODE_ENV as 'development' | 'production') || 'development',          │
│   });                                                                                              │
│ }                                                                                                  │
│                                                                                                    │
│ Both createAnthropicAdapter and createOpenAIAdapter ship with Sediment — same config interface     │
│ (apiKey, baseUrl?, maxConcurrency?, maxRetries?, retryBaseDelayMs?, timeoutMs?), same              │
│ CompletionsAdapter return type.                                                                    │
│                                                                                                    │
│ Step 7: SupabaseLogStore adapter                                                                   │
│                                                                                                    │
│ File: backend/src/adapters/supabase-log-store.ts                                                   │
│                                                                                                    │
│ Implements Sediment's LoggerInterface:                                                             │
│ interface LoggerInterface {                                                                        │
│   log(record: CompletionRecordInterface): void;                                                    │
│   getRecords(): CompletionRecordInterface[];                                                       │
│   logTool?(record: ToolRecordInterface): void;                                                     │
│   getToolRecords?(): ToolRecordInterface[];                                                        │
│ }                                                                                                  │
│ - log() inserts into completion_logs table (async, fire-and-forget with error logging)             │
│ - logTool() inserts tool execution records                                                         │
│ - getRecords() reads from in-memory buffer (for current request)                                   │
│ - Maps Sediment's CompletionRecord fields → DB columns: id, completion_id, context_id, request_id, │
│  user_id, conversation_id, product_name, product_step, model, params, completion, timing, tokens,  │
│ cost                                                                                               │
│                                                                                                    │
│ Step 8: Sediment Tasks                                                                             │
│                                                                                                    │
│ Files:                                                                                             │
│ - backend/src/tasks/chat-pipeline.ts — ChatPipelineTask (Layer 3)                                  │
│ - backend/src/tasks/chat-agent.ts — ChatAgentTask (Layer 2)                                        │
│ - backend/src/tasks/load-conversation.ts — LoadConversationTask                                    │
│ - backend/src/tasks/parse-input.ts — ParseInputTask (@mention extraction)                          │
│ - backend/src/tasks/save-message.ts — SaveMessageTask                                              │
│ - backend/src/tasks/update-conversation.ts — UpdateConversationTask                                │
│                                                                                                    │
│ All tasks use Sediment's defineTask and runTask APIs:                                              │
│                                                                                                    │
│ import { defineTask, runTask } from 'sediment/core/task';                                          │
│ import type { RuntimeDeps } from 'sediment/core/types';                                            │
│                                                                                                    │
│ // Example: ChatAgentTask streams tokens from the LLM                                              │
│ const chatAgentTask = defineTask<ChatAgentInput, string>(                                          │
│   'chat_agent',                                                                                    │
│   async function* (input, deps: RuntimeDeps) {                                                     │
│     // Build messages array with system prompt + conversation history + @mention context           │
│     const messages = buildMessages(input);                                                         │
│                                                                                                    │
│     // Stream via Sediment's CompletionsAdapter (works for both Anthropic + OpenAI)                │
│     for await (const chunk of deps.completions.complete({                                          │
│       model: input.modelId,  // e.g. 'claude-opus-4-5-20251101' or 'gpt-5.2'                       │
│       messages,                                                                                    │
│       maxTokens: 8192,                                                                             │
│       tools: deps.tools.list(),  // tool definitions for search_knowledge, get_document            │
│     })) {                                                                                          │
│       if (chunk.type === 'token') {                                                                │
│         yield chunk.content;  // Stream to SSE                                                     │
│       } else if (chunk.type === 'tool_call') {                                                     │
│         // Execute tool via Sediment's ToolsAdapter                                                │
│         const result = await deps.tools.execute(                                                   │
│           chunk.toolCall.name,                                                                     │
│           JSON.parse(chunk.toolCall.arguments)                                                     │
│         );                                                                                         │
│         // Continue generation with tool result (add to messages, re-call complete)                │
│       } else if (chunk.type === 'done') {                                                          │
│         // Log usage via deps.logger (automatic via adapter)                                       │
│       }                                                                                            │
│     }                                                                                              │
│   }                                                                                                │
│ );                                                                                                 │
│                                                                                                    │
│ The system prompt is ported from the existing constants.py INSTRUCTIONS string (strategic advisor  │
│ to Oxy, XML-structured persona with interaction guidelines, company context, and capabilities).    │
│                                                                                                    │
│ Step 9: API routes                                                                                 │
│                                                                                                    │
│ Files:                                                                                             │
│ - backend/src/routes/conversations.ts                                                              │
│   - POST /api/conversations — create                                                               │
│   - GET /api/conversations — list (grouped by date, with pinned support)                           │
│   - GET /api/conversations/:id — get with messages                                                 │
│   - PATCH /api/conversations/:id — update title/model/pinned                                       │
│   - DELETE /api/conversations/:id — soft delete                                                    │
│   - POST /api/conversations/:id/pin — toggle pin                                                   │
│ - backend/src/routes/chat.ts                                                                       │
│   - POST /api/conversations/:id/messages — send message, SSE stream response                       │
│ - backend/src/routes/transcripts.ts                                                                │
│   - GET /api/transcripts — list (for @mention autocomplete)                                        │
│   - GET /api/documents/search — search transcripts                                                 │
│                                                                                                    │
│ Step 10: SSE streaming                                                                             │
│                                                                                                    │
│ The chat endpoint returns a ReadableStream with Content-Type: text/event-stream. Events match the  │
│ PRD spec:                                                                                          │
│ data: {"type": "token", "content": "..."}                                                          │
│ data: {"type": "citation", "citation": {...}}                                                      │
│ data: {"type": "done", "message_id": "...", "citations": [...]}                                    │
│ data: {"type": "error", "error": "...", "code": "..."}                                             │
│                                                                                                    │
│ Note: The frontend currently expects content type, not token type. We'll add title_update and      │
│ thinking events as aliases for backward compatibility, OR update the frontend parser. Decision:    │
│ update the frontend to match PRD spec since we're updating api.ts anyway.                          │
│                                                                                                    │
│ Step 11: Update frontend API client                                                                │
│                                                                                                    │
│ File: frontend/src/lib/api.ts                                                                      │
│                                                                                                    │
│ Changes:                                                                                           │
│ - Update API_BASE_URL default (still localhost:8000)                                               │
│ - Update streamChat to POST to /api/conversations/:id/messages instead of /api/chat/stream         │
│ - Update SSE parser to handle new event types (token instead of content)                           │
│ - Update conversation endpoints to match new response shapes                                       │
│ - Remove draft-related functions (deferred)                                                        │
│ - Update types in frontend/src/types/index.ts                                                      │
│                                                                                                    │
│ File: frontend/src/hooks/useConversation.ts                                                        │
│ - Update sendMessage to use new endpoint path                                                      │
│ - Adapt to new SSE event format                                                                    │
│                                                                                                    │
│ Step 12: Update root package.json                                                                  │
│                                                                                                    │
│ {                                                                                                  │
│   "scripts": {                                                                                     │
│     "start": "concurrently --kill-others-on-fail --names backend,frontend \"pnpm run backend\"     │
│ \"pnpm run frontend\"",                                                                            │
│     "backend": "cd backend && pnpm run dev",                                                       │
│     "frontend": "cd frontend && pnpm run dev"                                                      │
│   }                                                                                                │
│ }                                                                                                  │
│                                                                                                    │
│ Step 13: Environment variables                                                                     │
│                                                                                                    │
│ Backend .env:                                                                                      │
│ SUPABASE_URL=https://xxx.supabase.co                                                               │
│ SUPABASE_SERVICE_KEY=eyJ...                                                                        │
│ ANTHROPIC_API_KEY=sk-ant-...                                                                       │
│ OPENAI_API_KEY=sk-...                                                                              │
│ WEBHOOK_SECRET=...                                                                                 │
│ PORT=8000                                                                                          │
│ NODE_ENV=development                                                                               │
│                                                                                                    │
│ Step 14: Railway deployment config                                                                 │
│                                                                                                    │
│ File: backend/Dockerfile                                                                           │
│ FROM node:20-slim                                                                                  │
│ WORKDIR /app                                                                                       │
│ COPY package.json pnpm-lock.yaml ./                                                                │
│ RUN corepack enable && pnpm install --frozen-lockfile                                              │
│ COPY . .                                                                                           │
│ RUN pnpm run build                                                                                 │
│ CMD ["node", "dist/index.js"]                                                                      │
│                                                                                                    │
│ ---                                                                                                │
│ File Tree (New Backend)                                                                            │
│                                                                                                    │
│ backend/                                                                                           │
│ ├── package.json                                                                                   │
│ ├── tsconfig.json                                                                                  │
│ ├── schema.sql              # Full Supabase schema                                                 │
│ ├── Dockerfile                                                                                     │
│ ├── src/                                                                                           │
│ │   ├── index.ts            # Hono app entrypoint                                                  │
│ │   ├── middleware/                                                                                │
│ │   │   └── auth.ts         # JWT validation, @oxy.so check                                        │
│ │   ├── lib/                                                                                       │
│ │   │   ├── supabase.ts     # Singleton client                                                     │
│ │   │   ├── runtime.ts      # Sediment Runtime factory                                             │
│ │   │   └── constants.ts    # System prompt, model configs                                         │
│ │   ├── adapters/                                                                                  │
│ │   │   └── supabase-log-store.ts  # Sediment LoggerInterface → Supabase                           │
│ │   ├── tasks/                                                                                     │
│ │   │   ├── chat-pipeline.ts       # Layer 3: Full chat flow                                       │
│ │   │   ├── chat-agent.ts          # Layer 2: Model + streaming                                    │
│ │   │   ├── load-conversation.ts   # Load conv + messages                                          │
│ │   │   ├── parse-input.ts         # @mention extraction                                           │
│ │   │   ├── save-message.ts        # Persist message                                               │
│ │   │   └── update-conversation.ts # Update title/timestamp                                        │
│ │   └── routes/                                                                                    │
│ │       ├── conversations.ts       # CRUD endpoints                                                │
│ │       ├── chat.ts                # SSE streaming                                                 │
│ │       └── transcripts.ts         # List/search                                                   │
│                                                                                                    │
│ ---                                                                                                │
│ Frontend Changes                                                                                   │
│ ┌───────────────────────────────┬─────────────────────────────────────────────────────────┐        │
│ │             File              │                         Change                          │        │
│ ├───────────────────────────────┼─────────────────────────────────────────────────────────┤        │
│ │ src/lib/api.ts                │ Rewrite to match PRD API contracts, new SSE event types │        │
│ ├───────────────────────────────┼─────────────────────────────────────────────────────────┤        │
│ │ src/types/index.ts            │ Update Message/Conversation types to match new schema   │        │
│ ├───────────────────────────────┼─────────────────────────────────────────────────────────┤        │
│ │ src/hooks/useConversation.ts  │ Update endpoint paths and SSE parsing                   │        │
│ ├───────────────────────────────┼─────────────────────────────────────────────────────────┤        │
│ │ src/hooks/useConversations.ts │ Update to new response shapes                           │        │
│ ├───────────────────────────────┼─────────────────────────────────────────────────────────┤        │
│ │ src/hooks/useDraft.ts         │ Disable or stub out (drafts deferred)                   │        │
│ └───────────────────────────────┴─────────────────────────────────────────────────────────┘        │
│ ---                                                                                                │
│ Verification                                                                                       │
│                                                                                                    │
│ After implementation, verify:                                                                      │
│                                                                                                    │
│ 1. [Works] Backend starts: cd backend && pnpm run dev — Hono server on port 8000                           
│ 2. [Works] Health check: curl http://localhost:8000/health returns 200                                     │
│ 3. [Works] Schema applied: Run schema.sql in Supabase SQL Editor, verify tables exist                      │
│ 4. Auth works: Frontend can authenticate via Google OAuth, backend validates JWT                   │
│ 5. Create conversation: POST /api/conversations returns new conversation                           │
│ 6. Send message: POST /api/conversations/:id/messages streams SSE tokens                           │
│ 7. Multi-model: Switch between Claude and GPT models, both stream correctly                        │
│ 8. Logs: Check completion_logs table has records after a chat                                      │
│ 9. Frontend E2E: Open app, create conversation, send message, see streaming response               │
│ 10. @mentions: Type @, see transcript list, select one, send — context injected correctly  