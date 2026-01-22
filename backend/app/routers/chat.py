"""Chat API router with SSE streaming."""

from __future__ import annotations

import json
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db, get_meeting_by_doc_id, Conversation, Message, Turn
from ..services.chat_service import chat_service
from ..services.vector_store import get_vector_store
from ..services.auto_title import generate_title
from ..services.tool_tracker import ToolTracker
from ..auth import get_optional_user
from ..constants import MAX_DOCUMENT_TOKENS, CHARS_PER_TOKEN

# For development: use a default user ID when auth is not provided
DEFAULT_DEV_USER = "dev-user-local"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


class ChatMessage(BaseModel):
    """A single chat message."""

    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Request body for chat endpoint."""

    conversation_id: str | None = None  # Optional conversation ID for persistence
    messages: list[ChatMessage]
    mentions: list[str] = []  # List of doc_ids (e.g., ["doc_123", "doc_456"])
    use_rag: bool = True  # Enable RAG for non-mention queries (Phase 1D)
    model: str = "claude-sonnet-4.5"  # Model to use for this request


def estimate_tokens(text: str) -> int:
    """Estimate token count from text using character-based approximation."""
    return len(text) // CHARS_PER_TOKEN


async def build_context_from_mentions(
    mentions: list[str],
    db: AsyncSession,
) -> tuple[str | None, list[dict], list[dict], list[dict]]:
    """
    Build context string from @mentioned transcripts with token limits.

    Uses XML format for optimal LLM parsing (per Anthropic best practices).
    First-mentioned documents have priority - later ones may be truncated.

    Returns:
        Tuple of (context_string, sources_list, truncation_info, failed_mentions)
    """
    if not mentions:
        return None, [], [], []

    context_parts = []
    sources = []
    truncation_info = []
    failed_mentions = []
    tokens_used = 0

    for doc_id in mentions[:5]:  # Max 5 transcripts
        meeting = await get_meeting_by_doc_id(db, doc_id)
        if not meeting:
            logger.warning(f"Mention lookup failed: doc_id '{doc_id}' not found in database")
            failed_mentions.append({"doc_id": doc_id, "reason": "not_found"})
            continue

        content = meeting.formatted_content or ""
        content_tokens = estimate_tokens(content)
        tokens_remaining = MAX_DOCUMENT_TOKENS - tokens_used

        if tokens_remaining <= 0:
            # No room left - skip entirely
            truncation_info.append({
                "doc_id": meeting.doc_id,
                "title": meeting.title,
                "truncated": True,
                "percent_included": 0,
            })
            logger.info(f"Skipped transcript {meeting.doc_id} - no token budget remaining")
            continue

        if content_tokens > tokens_remaining:
            # Truncate to fit
            chars_to_keep = tokens_remaining * CHARS_PER_TOKEN
            content = content[:chars_to_keep] + "\n\n[Document truncated to fit context limit]"
            percent_included = round((tokens_remaining / content_tokens) * 100)
            truncation_info.append({
                "doc_id": meeting.doc_id,
                "title": meeting.title,
                "truncated": True,
                "percent_included": percent_included,
            })
            logger.info(f"Truncated transcript {meeting.doc_id} to {percent_included}%")
        else:
            truncation_info.append({
                "doc_id": meeting.doc_id,
                "title": meeting.title,
                "truncated": False,
                "percent_included": 100,
            })

        tokens_used += estimate_tokens(content)

        # Use XML format for document context (per Anthropic best practices)
        date_str = meeting.date if meeting.date else "Unknown"
        context_parts.append(
            f'<document title="{meeting.title}" date="{date_str}" doc_id="{meeting.doc_id}">\n'
            f'{content}\n'
            f'</document>'
        )
        sources.append({
            "doc_id": meeting.doc_id,
            "title": meeting.title,
            "type": "mention",
        })
        logger.info(f"Added context for transcript: {meeting.doc_id}")

    if not context_parts:
        return None, [], [], failed_mentions

    # XML-structured context header
    header = (
        "<user_documents>\n"
        "The user has referenced the following meeting transcripts. Use them to answer their question.\n\n"
    )
    footer = "\n</user_documents>"

    return header + "\n\n".join(context_parts) + footer, sources, truncation_info, failed_mentions


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
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    user_id = user_id or DEFAULT_DEV_USER
    """
    Stream a chat response with optional transcript context.

    Context is built in this priority:
    1. If @mentions provided: Use full transcript content from mentions
    2. If use_rag=True and no mentions: Use RAG vector search

    If conversation_id is provided:
    - Saves user message to database before streaming
    - Saves assistant response to database after streaming
    - Auto-titles conversation after first complete exchange

    The response is a Server-Sent Events stream with JSON chunks:
    - {"type": "sources", "sources": [...]} - Sources used for context (first)
    - {"type": "content", "content": "..."} - Text content chunks
    - {"type": "done"} - Stream complete
    - {"type": "error", "error": "..."} - Error occurred
    """
    logger.info(
        f"Chat request: {len(request.messages)} messages, "
        f"{len(request.mentions)} mentions, use_rag={request.use_rag}, "
        f"conversation_id={request.conversation_id}"
    )

    # Save user message to database if conversation_id provided
    conversation = None
    user_message_db = None
    turn = None
    tool_tracker = None

    if request.conversation_id:
        # Verify conversation exists
        stmt = select(Conversation).where(
            Conversation.id == request.conversation_id,
            # Conversation.user_id == user_id,  # Disabled for dev
            Conversation.deleted_at.is_(None)
        )
        result = await db.execute(stmt)
        conversation = result.scalar_one_or_none()

        if conversation:
            # Create a Turn for this exchange
            # Get next sequence number
            stmt = select(Turn).where(Turn.conversation_id == request.conversation_id).order_by(Turn.sequence.desc()).limit(1)
            result = await db.execute(stmt)
            last_turn = result.scalar_one_or_none()
            next_sequence = (last_turn.sequence + 1) if last_turn else 1

            turn = Turn(
                id=str(uuid.uuid4()),
                conversation_id=request.conversation_id,
                sequence=next_sequence,
            )
            db.add(turn)
            await db.commit()
            await db.refresh(turn)
            logger.info(f"Created turn {turn.id} (sequence {next_sequence}) for conversation {request.conversation_id}")

            # Initialize tool tracker for this turn
            tool_tracker = ToolTracker(db, turn.id)

            # Save the latest user message
            for msg in reversed(request.messages):
                if msg.role == "user":
                    user_message_db = Message(
                        conversation_id=request.conversation_id,
                        role="user",
                        content=msg.content,
                        mentions=request.mentions,
                        turn_id=turn.id,  # Link to turn
                    )
                    db.add(user_message_db)
                    await db.commit()
                    await db.refresh(user_message_db)
                    logger.info(f"Saved user message to conversation {request.conversation_id}")
                    break

    context = None
    sources = []
    truncation_info = []
    failed_mentions = []

    # Get the latest user message for RAG query
    user_query = ""
    for msg in reversed(request.messages):
        if msg.role == "user":
            user_query = msg.content
            break

    if request.mentions:
        # Priority 1: Use full transcripts from @mentions
        context, sources, truncation_info, failed_mentions = await build_context_from_mentions(request.mentions, db)

        # Track mention tool usage
        if tool_tracker and sources:
            await tool_tracker.track_mention(
                mentions=[{"doc_id": m} for m in request.mentions],
                context_sources=sources,
                message_id=str(user_message_db.id) if user_message_db else None,
            )
            logger.info(f"Tracked @mention tool usage for turn {turn.id}")

    elif request.use_rag and user_query:
        # Priority 2: Use RAG vector search
        context, sources = build_context_from_rag(user_query)

        # Track RAG tool usage
        if tool_tracker and sources:
            await tool_tracker.track_rag(
                query=user_query,
                results=sources,
                retrieval_method="chromadb",
                message_id=str(user_message_db.id) if user_message_db else None,
            )
            logger.info(f"Tracked RAG tool usage for turn {turn.id}")

    # Convert to OpenAI format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    # Accumulate assistant response
    assistant_response = ""

    async def generate():
        nonlocal assistant_response

        # First, send sources metadata if any (include truncation info and failed mentions)
        if sources or failed_mentions:
            sources_data = {
                'type': 'sources',
                'sources': sources,
            }
            if truncation_info:
                sources_data['truncation_info'] = truncation_info
            if failed_mentions:
                sources_data['failed_mentions'] = failed_mentions
                logger.warning(f"Failed mentions being sent to client: {failed_mentions}")
            yield f"data: {json.dumps(sources_data)}\n\n"

        # Then stream the response
        async for chunk in chat_service.stream_response(messages, context):
            # Extract content from chunk
            if chunk.startswith("data: "):
                try:
                    data = chunk[6:].strip()
                    if data and data != "[DONE]":
                        parsed = json.loads(data)
                        if parsed.get("type") == "content" and parsed.get("content"):
                            assistant_response += parsed["content"]
                except:
                    pass

            yield chunk

        # After streaming completes, save assistant message to database
        if conversation and request.conversation_id and assistant_response:
            assistant_message_db = Message(
                conversation_id=request.conversation_id,
                role="assistant",
                content=assistant_response,
                model=request.model,
                mentions=request.mentions,
                turn_id=turn.id if turn else None,  # Link to turn
            )
            db.add(assistant_message_db)

            # Update conversation's updated_at timestamp
            conversation.updated_at = __import__('datetime').datetime.now()

            await db.commit()
            await db.refresh(assistant_message_db)
            logger.info(f"Saved assistant message to conversation {request.conversation_id}")

            # Auto-title if this is the first complete exchange
            if conversation and not conversation.auto_titled:
                # Check if this is the first exchange (2 messages: 1 user + 1 assistant)
                stmt = select(Message).where(Message.conversation_id == request.conversation_id)
                result = await db.execute(stmt)
                message_count = len(list(result.scalars().all()))

                if message_count == 2:  # First user message + first assistant response
                    try:
                        title = await generate_title(user_query)
                        conversation.title = title
                        conversation.auto_titled = True
                        await db.commit()
                        logger.info(f"Auto-titled conversation {request.conversation_id}: {title}")
                    except Exception as e:
                        logger.error(f"Failed to auto-title conversation: {e}")

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
