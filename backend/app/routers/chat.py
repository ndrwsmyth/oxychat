"""Chat API router with SSE streaming."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db, get_meeting_by_doc_id
from ..services.chat_service import chat_service
from ..services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    """A single chat message."""

    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    messages: list[ChatMessage]
    mentions: list[str] = []  # List of doc_ids (e.g., ["doc_123", "doc_456"])
    use_rag: bool = True  # Enable RAG for non-mention queries (Phase 1D)


async def build_context_from_mentions(
    mentions: list[str],
    db: AsyncSession,
) -> tuple[str | None, list[dict]]:
    """
    Build context string from @mentioned transcripts.

    Returns:
        Tuple of (context_string, sources_list)
    """
    if not mentions:
        return None, []

    context_parts = []
    sources = []

    for doc_id in mentions[:5]:  # Max 5 transcripts
        meeting = await get_meeting_by_doc_id(db, doc_id)
        if meeting:
            context_parts.append(
                f"---\n"
                f"Title: {meeting.title}\n"
                f"ID: {meeting.doc_id}\n"
                f"Date: {meeting.date}\n"
                f"Transcript:\n{meeting.formatted_content}\n"
            )
            sources.append(
                {
                    "doc_id": meeting.doc_id,
                    "title": meeting.title,
                    "type": "mention",
                }
            )
            logger.info(f"Added context for transcript: {meeting.doc_id}")

    if not context_parts:
        return None, []

    header = (
        "# User-provided context for @-mentions\n"
        "Use the following transcript(s) to answer the user's question.\n\n"
    )
    return header + "\n".join(context_parts), sources


def build_context_from_rag(
    query: str,
    doc_ids: list[str] | None = None,
    n_results: int = 3,
) -> tuple[str | None, list[dict]]:
    """
    Build context string from RAG vector search.

    Args:
        query: The user's question
        doc_ids: Optional list of doc_ids to filter by (from @mentions)
        n_results: Number of chunks to retrieve

    Returns:
        Tuple of (context_string, sources_list)
    """
    try:
        vector_store = get_vector_store()
        results = vector_store.search(
            query=query,
            n_results=n_results,
            doc_ids=doc_ids,
        )

        if not results:
            return None, []

        context_parts = ["# Relevant context from meeting transcripts\n"]
        sources = []
        seen_docs = set()

        for r in results:
            context_parts.append(f"--- From \"{r['title']}\" ({r['date']}) ---")
            context_parts.append(r["content"])
            context_parts.append("")

            # Track unique sources
            if r["doc_id"] not in seen_docs:
                sources.append({
                    "doc_id": r["doc_id"],
                    "title": r["title"],
                    "type": "rag",
                })
                seen_docs.add(r["doc_id"])

        logger.info(f"RAG retrieved {len(results)} chunks from {len(sources)} documents")
        return "\n".join(context_parts), sources

    except Exception as e:
        logger.warning(f"RAG search failed: {e}")
        return None, []


@router.post("/stream")
async def stream_chat(
    request: ChatRequest,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """
    Stream a chat response with optional transcript context.

    Context is built in this priority:
    1. If @mentions provided: Use full transcript content from mentions
    2. If use_rag=True and no mentions: Use RAG vector search

    The response is a Server-Sent Events stream with JSON chunks:
    - {"type": "sources", "sources": [...]} - Sources used for context (first)
    - {"type": "content", "content": "..."} - Text content chunks
    - {"type": "done"} - Stream complete
    - {"type": "error", "error": "..."} - Error occurred
    """
    logger.info(
        f"Chat request: {len(request.messages)} messages, "
        f"{len(request.mentions)} mentions, use_rag={request.use_rag}"
    )

    context = None
    sources = []

    # Get the latest user message for RAG query
    user_query = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_query = msg.content
            break

    if request.mentions:
        # Priority 1: Use full transcripts from @mentions
        context, sources = await build_context_from_mentions(request.mentions, db)
    elif request.use_rag and user_query:
        # Priority 2: Use RAG vector search
        context, sources = build_context_from_rag(user_query)

    # Convert to OpenAI format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    async def generate():
        # First, send sources metadata if any
        if sources:
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"

        # Then stream the response
        async for chunk in chat_service.stream_response(messages, context):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
