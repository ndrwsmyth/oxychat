"""Message management endpoints for versioning and regeneration."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.database import get_db, Message, Conversation
from app.auth import get_current_user

router = APIRouter(prefix="/api/messages", tags=["messages"])


# Request/Response Models
class RegenerateMessageRequest(BaseModel):
    """Request to regenerate an assistant message."""
    pass  # No body needed, parent_message_id in URL


class RegenerateMessageResponse(BaseModel):
    """Metadata for regeneration - frontend should request new response via /chat/stream"""
    parent_message_id: str
    conversation_id: str
    next_version: int
    message: str


@router.post("/{message_id}/regenerate", response_model=RegenerateMessageResponse)
async def regenerate_message(
    message_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Prepare for message regeneration.

    Returns metadata for the frontend to request a new response via /chat/stream
    with parent_message_id set. The new message will have version incremented.

    Args:
        message_id: ID of the assistant message to regenerate
        user_id: Authenticated user ID
        db: Database session

    Returns:
        RegenerateMessageResponse with parent info and next version number
    """
    # Get the message and verify ownership
    stmt = select(Message).where(Message.id == message_id)
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get conversation to verify user ownership
    stmt = select(Conversation).where(
        Conversation.id == message.conversation_id,
        Conversation.user_id == user_id,
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")

    # Only allow regeneration of assistant messages
    if message.role != "assistant":
        raise HTTPException(status_code=400, detail="Can only regenerate assistant messages")

    # Find all versions of this message (messages with same parent or same id as parent)
    parent_id = message.parent_message_id or message.id
    stmt = select(Message).where(
        (Message.id == parent_id) | (Message.parent_message_id == parent_id)
    ).order_by(Message.version.desc())
    result = await db.execute(stmt)
    versions = list(result.scalars().all())

    # Calculate next version number
    max_version = max(msg.version for msg in versions) if versions else 0
    next_version = max_version + 1

    return RegenerateMessageResponse(
        parent_message_id=parent_id,
        conversation_id=message.conversation_id,
        next_version=next_version,
        message="Regenerate by calling /api/chat/stream with parent_message_id in the request"
    )


@router.get("/{message_id}/versions")
async def get_message_versions(
    message_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all versions of a message.

    Returns all message versions that share the same parent_message_id,
    including the original message.

    Args:
        message_id: ID of any version of the message
        user_id: Authenticated user ID
        db: Database session

    Returns:
        List of message versions ordered by version number
    """
    # Get the message and verify ownership
    stmt = select(Message).where(Message.id == message_id)
    result = await db.execute(stmt)
    message = result.scalar_one_or_none()

    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Get conversation to verify user ownership
    stmt = select(Conversation).where(
        Conversation.id == message.conversation_id,
        Conversation.user_id == user_id,
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")

    # Find parent ID
    parent_id = message.parent_message_id or message.id

    # Get all versions
    stmt = select(Message).where(
        (Message.id == parent_id) | (Message.parent_message_id == parent_id)
    ).order_by(Message.version.asc())
    result = await db.execute(stmt)
    versions = list(result.scalars().all())

    return [
        {
            "id": msg.id,
            "content": msg.content,
            "version": msg.version,
            "model": msg.model,
            "created_at": msg.created_at,
            "is_current": msg.id == message_id,
        }
        for msg in versions
    ]
