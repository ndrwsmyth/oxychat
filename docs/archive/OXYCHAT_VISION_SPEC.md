# OxyChat Vision & Architecture Spec

*Generated from product interview, December 2024*

---

## Executive Summary

OxyChat is evolving from a ChatKit-based transcript Q&A tool into a **full AI workspace platform** for Oxy (a U.S. design agency). The platform will provide context-aware AI assistance across meeting transcripts, documents, and eventually multiple communication channels.

**Core value proposition**: An AI assistant that knows your meetings, projects, and context - eliminating re-explanation and automating busywork.

---

## Current Pain Points (Active)

- Time lost re-explaining context to AI tools
- Manual effort to find relevant information across meeting transcripts
- No automated brief/summary generation after calls
- Fragmented workflow across multiple tools

---

## Success Criteria (3-Month Vision)

1. **Instant transcript answers** - Ask any question, get accurate answers from any meeting
2. **Auto-generated briefs** - After calls, useful briefs appear with minimal effort
3. **Context that follows** - AI knows projects, clients, history without re-explaining
4. **Agents handle busywork** - Kick off tasks, they complete without babysitting

---

## Architecture Principles

### Guiding Constraints

| Principle | Rationale |
|-----------|-----------|
| **Avoid lock-in** | Biggest risk identified; design for swappability |
| **API-first backend** | Frontend can change; backend should be stable |
| **Incremental complexity** | Start simple, add sophistication as needed |
| **Solo-to-team ready** | Build for one, design for many |

### Key Decision: ChatKit

**Recommendation: Build custom UI with shadcn instead of ChatKit**

Rationale:
- Full vision requires workspace views (agent tasks, documents, projects) beyond chat
- ChatKit is optimized for chat-only UIs; custom components would feel inconsistent
- Risk of hitting ChatKit limits mid-build when switching is expensive
- shadcn provides accessible, customizable primitives for both chat AND workspace UI
- Chat streaming UI is achievable with standard patterns (not as complex as full ChatKit feature set)

**Migration path**: Keep ChatKit backend compatibility (the protocol), swap frontend to custom React.

---

## Technical Architecture

### Stack Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                          │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │ Chat Panel │ │  Document  │ │   Agent    │ │ Project  │ │
│  │ (shadcn)   │ │  Library   │ │   Tasks    │ │ Overview │ │
│  └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│                    shadcn/ui + Tailwind                      │
└─────────────────────────────────────────────────────────────┘
                              │
                         REST/WebSocket
                              │
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    API Layer                          │  │
│  │  /chat  /transcripts  /documents  /agents  /projects │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │    Router    │  │  Agent Engine   │  │  RAG Engine  │  │
│  │ (rule+AI)    │  │ (OpenAI Agents) │  │  (Chroma)    │  │
│  └──────────────┘  └─────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                │
│  ┌──────────────────┐    ┌──────────────────────────────┐  │
│  │  Supabase (PG)   │    │       Chroma (Vectors)       │  │
│  │  - Transcripts   │    │  - Transcript embeddings     │  │
│  │  - Documents     │    │  - Document embeddings       │  │
│  │  - Projects      │    │  - Semantic search index     │  │
│  │  - Agent tasks   │    │                              │  │
│  └──────────────────┘    └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend (Custom React + shadcn)

| Component | Purpose |
|-----------|---------|
| **Chat Panel** | Streaming chat interface with `/` commands and `@` mentions |
| **Document Library** | Browse, search, organize transcripts and AI outputs |
| **Agent Task Manager** | View running tasks, queue, history, results |
| **Project Overview** | High-level view by client/project |
| **Transcript Viewer** | Read full transcripts with highlights/search |

#### Backend Services

| Service | Technology | Purpose |
|---------|------------|---------|
| **API Gateway** | FastAPI | REST endpoints, WebSocket for streaming |
| **Chat Service** | OpenAI API | Direct LLM calls with context injection |
| **Agent Engine** | OpenAI Agents SDK | Multi-step task execution |
| **Router** | Custom + LLM | Route queries to appropriate handler |
| **RAG Engine** | Chroma + LangChain | Semantic search over transcripts |
| **Ingestion** | CircleBack webhook | Auto-import meeting transcripts |

#### Data Models

```
Transcript
├── id (uuid)
├── doc_id (slug for @mentions)
├── title
├── date
├── attendees (json)
├── content (full text)
├── summary (optional)
├── source (circleback, manual, etc.)
├── project_id (fk, optional)
└── embedding_id (chroma ref)

Document
├── id (uuid)
├── title
├── content (markdown)
├── type (brief, notes, analysis, etc.)
├── source_transcripts (array of ids)
├── status (draft, approved, archived)
├── project_id (fk, optional)
└── created_by, created_at, updated_at

AgentTask
├── id (uuid)
├── type (brief, analysis, research, etc.)
├── status (pending, running, paused, completed, failed)
├── input (json - what was requested)
├── output (json - what was produced)
├── context_ids (transcripts/docs referenced)
├── checkpoints (json - for pauseable tasks)
├── started_at, completed_at
└── error (if failed)

Project
├── id (uuid)
├── name
├── client
├── status (active, archived)
└── metadata (json)
```

---

## Interaction Patterns

### Chat Input Features

| Pattern | Example | Behavior |
|---------|---------|----------|
| **@-mention** | `@weekly_planning` | Injects full transcript context |
| **Multi-mention** | `@call1 @call2` | Injects multiple transcripts |
| **/ command** | `/brief` | Triggers template or action |
| **Plain text** | "What did we discuss?" | Routes through RAG or direct |

### Agent Task Types

| Type | Sync/Async | Notification |
|------|------------|--------------|
| **Quick Q&A** | Sync (streaming) | Inline response |
| **Brief generation** | Async | Notification when done |
| **Multi-transcript analysis** | Async | Progress updates + completion |
| **Research/exploration** | Async with checkpoints | Pauses for approval at key points |

### Output Review Flow

```
Agent produces output
        │
        ▼
  Appears in "Drafts"
        │
        ▼
  User reviews/edits
        │
        ▼
  User approves ───► Document saved
        │              (or exported to Google Docs, etc.)
        ▼
  User requests changes ───► Agent revises
```

---

## Phased Implementation

### Phase 1: Foundation (MVP)

**Goal**: Transcript Q&A that works, direct load + RAG

**Scope**:
- [ ] Custom chat UI with shadcn (replace ChatKit frontend)
- [ ] Streaming responses with OpenAI API
- [ ] `@` mention system for transcript inclusion
- [ ] Supabase transcript storage (keep existing)
- [ ] Chroma integration for vector search
- [ ] RAG pipeline: embed transcripts → semantic search → inject context
- [ ] CircleBack webhook (keep existing)
- [ ] Manual transcript upload (file + paste)
- [ ] Basic document library view (list transcripts)

**Deliverable**: Ask questions across all transcripts, get accurate answers

### Phase 2: Agent Workflows

**Goal**: Background agents that produce useful outputs

**Scope**:
- [ ] Agent task queue system
- [ ] Brief generation workflow
- [ ] Task status UI (running, completed, failed)
- [ ] Notification system (in-app initially)
- [ ] `/` command system for templates
- [ ] Template library (brief, recap, analysis)
- [ ] Draft review/approval flow
- [ ] Agent checkpoint system for long tasks

**Deliverable**: Kick off brief generation, review and approve outputs

### Phase 3: Workspace Expansion

**Goal**: Full workspace with project organization

**Scope**:
- [ ] Project/client data model
- [ ] Project overview dashboard
- [ ] Document organization by project
- [ ] Cross-project analysis
- [ ] Environment concept (workspaces?)
- [ ] Team foundations (auth, permissions)

**Deliverable**: Organized workspace, ready for team expansion

### Phase 4: Multi-Channel (Future)

**Goal**: Access OxyChat from Slack, phone, email

**Scope**:
- [ ] Slack integration (@oxy mentions)
- [ ] Context persistence across channels
- [ ] Router for channel-appropriate responses
- [ ] Voice input (phone/voice memo)
- [ ] Email integration
- [ ] AI-drafted responses

**Deliverable**: Unified AI assistant across all communication channels

---

## Key Decisions

### Resolved

| Decision | Choice | Rationale |
|----------|--------|-----------|
| RAG vector store | Chroma | Self-hosted, open source, good ecosystem |
| Primary database | Supabase (PostgreSQL) | Already in use, proven |
| UI framework | React + shadcn | Flexibility, component ownership |
| Styling | Tailwind | Already in use, works well |
| Backend | FastAPI (Python) | Already in use, async-native |
| LLM provider | OpenAI | Already integrated, quality |
| Output review | Human-in-the-loop | All agent outputs reviewed before final |
| Transcript sources | CircleBack + manual upload | Flexibility in ingestion |

### Open (Decide During Implementation)

| Decision | Options | When to Decide |
|----------|---------|----------------|
| Agent orchestration | Custom vs LangGraph | Phase 2 - evaluate complexity needed |
| Router implementation | Rule-based vs LLM vs hybrid | Phase 2 - based on routing patterns |
| Real-time updates | WebSocket vs SSE vs polling | Phase 1 - based on streaming needs |
| Notification delivery | In-app vs Slack vs both | Phase 2 - based on workflow |
| Embedding model | OpenAI vs local (e.g., BGE) | Phase 1 - cost vs quality tradeoff |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Tech lock-in** | API-first design, standard interfaces, avoid deep framework coupling |
| **Scope creep** | Strict phase boundaries, MVP focus, defer nice-to-haves |
| **Over-engineering** | Build for current needs, refactor when pain emerges |
| **RAG quality issues** | Start with direct injection, add RAG incrementally, tune retrieval |
| **Agent reliability** | Human review for all outputs, checkpoints for long tasks |

---

## Migration Path from Current State

### What to Keep
- FastAPI backend structure
- Supabase database and connection
- CircleBack webhook integration
- Transcript data model (extend, don't replace)
- OpenAI API integration

### What to Replace
- ChatKit React frontend → Custom shadcn components
- ChatKit protocol (optional) → Standard REST/WebSocket
- In-memory store → Supabase for persistence
- File-based transcripts → DB-only with Chroma embeddings

### What to Add
- Chroma for vector storage
- Custom chat streaming component
- Agent task system
- Document management
- `/` commands and templates

---

## Immediate Next Steps

1. **Set up Chroma** - Local instance, test embedding pipeline
2. **Build chat component** - shadcn-based, streaming support
3. **Implement RAG pipeline** - Embed existing transcripts, test retrieval
4. **Migrate off ChatKit frontend** - Keep backend working during transition
5. **Add manual transcript upload** - File upload + paste interface

---

## Appendix: Environment Concept (TBD)

The "working environment" concept emerged during interview but needs further exploration:

- Mix of **client/project-based** and **team/role-based** contexts
- Potentially affects what transcripts/documents are visible
- May influence routing (e.g., client context → client-specific agent behavior)
- Needs UX design before implementation

**Parking this for Phase 3** when project organization is built out.

---

*This spec is a living document. Update as decisions are made and learnings emerge.*
