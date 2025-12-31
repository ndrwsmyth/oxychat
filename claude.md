# OxyChat

AI workspace platform for Oxy, a U.S. design agency. Helps Andrew Smyth with planning, writing, analysis, and decision-making using meeting transcripts as the primary knowledge base.

## What This Is

Evolving from a ChatKit-based Q&A tool into a full AI workspace. Core innovation: context-aware AI that knows your meetings, projects, and history without re-explanation.

## Current State

- React frontend (Vite, TypeScript, Tailwind) with FastAPI backend (Python 3.11+)
- Supabase for transcript storage, CircleBack webhook for meeting ingestion
- OpenAI API for LLM calls, ChatKit for chat UI (being replaced with shadcn)

## Roadmap

- Phase 1 (MVP): Custom chat UI + Chroma RAG over transcripts
- Phase 2: Agent workflows, brief generation, task queue, `/` commands
- Phase 3: Full workspace with projects, documents, team foundations
- Phase 4: Multi-channel access (Slack, phone, email)

## Key Features

- `@mention` to reference specific transcripts in queries
- `/commands` for templates and actions (briefs, recaps, analysis)
- RAG search across all transcripts using Chroma
- Background agents for long-running tasks with human review

## Architecture Principles

- API-first backend (UI-agnostic, swappable frontend)
- Avoid lock-in (standard interfaces, minimal framework coupling)
- Human-in-the-loop (all agent outputs reviewed before final)

## Tech Stack

Frontend: React + shadcn/ui + Tailwind | Backend: FastAPI + OpenAI Agents SDK
Database: Supabase (PostgreSQL) | Vectors: Chroma | LLM: OpenAI

## Key Files

- `backend/app/chat.py` - Chat service and agent setup
- `backend/app/database.py` - Supabase connection and models
- `backend/app/webhook.py` - CircleBack transcript ingestion
- `backend/app/converters.py` - @mention to transcript context
- `frontend/src/components/ChatKitPanel.tsx` - Chat UI (being replaced)
- `OXYCHAT_VISION_SPEC.md` - Full architecture spec and roadmap

## Development

Backend: `cd backend && uv run uvicorn app.main:app --reload --port 8000`
Frontend: `cd frontend && npm run dev` | Env: OPENAI_API_KEY, SUPABASE_DATABASE_URL