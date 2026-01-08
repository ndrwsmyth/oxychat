"""Full-text search endpoints for conversations and messages."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from app.database import get_db, Conversation, Message
from app.auth import get_current_user

router = APIRouter(prefix="/api/search", tags=["search"])


# Response Models
class ConversationSearchResult(BaseModel):
    id: str
    title: str
    model: str
    pinned: bool
    created_at: datetime
    updated_at: datetime
    rank: float
    message_count: int

    class Config:
        from_attributes = True


class MessageSearchResult(BaseModel):
    id: str
    conversation_id: str
    conversation_title: str
    role: str
    content: str
    created_at: datetime
    rank: float

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    conversations: list[ConversationSearchResult]
    messages: list[MessageSearchResult]
    total_results: int


@router.get("", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results per category"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Full-text search across conversation titles and message content.

    Uses PostgreSQL's full-text search with ts_rank for relevance scoring.
    Results are scoped to the authenticated user only.

    Args:
        q: Search query string
        limit: Maximum number of results per category (default 20)
        user_id: Authenticated user ID from JWT
        db: Database session

    Returns:
        SearchResponse with ranked conversations and messages
    """
    # Create tsquery from search string
    # plainto_tsquery handles natural language queries (spaces, special chars)
    tsquery = func.plainto_tsquery("english", q)

    # Search conversations by title
    conversation_stmt = (
        select(
            Conversation.id,
            Conversation.title,
            Conversation.model,
            Conversation.pinned,
            Conversation.created_at,
            Conversation.updated_at,
            func.ts_rank(Conversation.title_tsv, tsquery).label("rank"),
            # Count messages in this conversation
            func.count(Message.id).label("message_count"),
        )
        .outerjoin(Message, Message.conversation_id == Conversation.id)
        .where(
            Conversation.user_id == user_id,
            Conversation.deleted_at.is_(None),
            Conversation.title_tsv.op("@@")(tsquery),  # Match tsquery
        )
        .group_by(Conversation.id, Conversation.title_tsv, tsquery)
        .order_by(text("rank DESC"))
        .limit(limit)
    )

    # Search messages by content
    message_stmt = (
        select(
            Message.id,
            Message.conversation_id,
            Conversation.title.label("conversation_title"),
            Message.role,
            Message.content,
            Message.created_at,
            func.ts_rank(Message.content_tsv, tsquery).label("rank"),
        )
        .join(Conversation, Conversation.id == Message.conversation_id)
        .where(
            Conversation.user_id == user_id,
            Conversation.deleted_at.is_(None),
            Message.content_tsv.op("@@")(tsquery),  # Match tsquery
        )
        .order_by(text("rank DESC"))
        .limit(limit)
    )

    # Execute both queries
    conv_result = await db.execute(conversation_stmt)
    msg_result = await db.execute(message_stmt)

    conversations = [
        ConversationSearchResult(
            id=row.id,
            title=row.title,
            model=row.model,
            pinned=row.pinned,
            created_at=row.created_at,
            updated_at=row.updated_at,
            rank=row.rank,
            message_count=row.message_count,
        )
        for row in conv_result.all()
    ]

    messages = [
        MessageSearchResult(
            id=row.id,
            conversation_id=row.conversation_id,
            conversation_title=row.conversation_title,
            role=row.role,
            content=row.content,
            created_at=row.created_at,
            rank=row.rank,
        )
        for row in msg_result.all()
    ]

    return SearchResponse(
        conversations=conversations,
        messages=messages,
        total_results=len(conversations) + len(messages),
    )
