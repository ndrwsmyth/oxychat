from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete as sql_delete
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta

from app.database import get_db, Conversation, Message, ConversationDraft
from app.services.auto_title import generate_title
from app.auth import get_optional_user

# For development: use a default user ID when auth is not provided
DEFAULT_DEV_USER = "dev-user-local"

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


# Request/Response Models
class CreateConversationRequest(BaseModel):
    title: Optional[str] = "New conversation"
    model: Optional[str] = "claude-sonnet-4.5"


class UpdateConversationRequest(BaseModel):
    title: Optional[str] = None
    model: Optional[str] = None
    pinned: Optional[bool] = None


class ConversationResponse(BaseModel):
    id: str
    title: str
    auto_titled: bool
    model: str
    pinned: bool
    pinned_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    model: Optional[str]
    mentions: dict
    created_at: datetime

    class Config:
        from_attributes = True


class GroupedConversationsResponse(BaseModel):
    pinned: list[ConversationResponse]
    today: list[ConversationResponse]
    yesterday: list[ConversationResponse]
    last_7_days: list[ConversationResponse]
    last_30_days: list[ConversationResponse]
    older: list[ConversationResponse]


class DraftRequest(BaseModel):
    content: str


class DraftResponse(BaseModel):
    content: str


# Helper functions
def group_conversations_by_date(conversations: list[Conversation]) -> GroupedConversationsResponse:
    """Group conversations by date buckets."""
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_ago = today_start - timedelta(days=7)
    month_ago = today_start - timedelta(days=30)

    grouped = GroupedConversationsResponse(
        pinned=[],
        today=[],
        yesterday=[],
        last_7_days=[],
        last_30_days=[],
        older=[],
    )

    for conv in conversations:
        conv_response = ConversationResponse.model_validate(conv)

        if conv.pinned:
            grouped.pinned.append(conv_response)
            continue

        if conv.updated_at >= today_start:
            grouped.today.append(conv_response)
        elif conv.updated_at >= yesterday_start:
            grouped.yesterday.append(conv_response)
        elif conv.updated_at >= week_ago:
            grouped.last_7_days.append(conv_response)
        elif conv.updated_at >= month_ago:
            grouped.last_30_days.append(conv_response)
        else:
            grouped.older.append(conv_response)

    return grouped


# Endpoints
@router.get("", response_model=GroupedConversationsResponse)
async def list_conversations(
    search: Optional[str] = None,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = user_id or DEFAULT_DEV_USER
    """List all conversations for the authenticated user, grouped by date."""
    # Note: user_id filtering disabled for dev (model doesn't have user_id yet)
    stmt = select(Conversation).where(
        Conversation.deleted_at.is_(None)
    )

    if search:
        stmt = stmt.where(Conversation.title.ilike(f"%{search}%"))

    # Order: pinned first (by pinned_at desc), then by updated_at desc
    stmt = stmt.order_by(
        Conversation.pinned.desc(),
        Conversation.pinned_at.desc().nullslast(),
        Conversation.updated_at.desc()
    )

    result = await db.execute(stmt)
    conversations = list(result.scalars().all())

    return group_conversations_by_date(conversations)


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    request: CreateConversationRequest,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new conversation for the authenticated user."""
    user_id = user_id or DEFAULT_DEV_USER
    conversation = Conversation(
        # user_id=user_id,  # Disabled for dev - model doesn't have user_id
        title=request.title or "New conversation",
        model=request.model or "claude-sonnet-4.5",
        auto_titled=False,
        pinned=False,
    )

    db.add(conversation)
    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse.model_validate(conversation)


@router.get("/{conversation_id}", response_model=ConversationResponse)
async def get_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single conversation (must be owned by authenticated user)."""
    user_id = user_id or DEFAULT_DEV_USER
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    return ConversationResponse.model_validate(conversation)


@router.patch("/{conversation_id}", response_model=ConversationResponse)
async def update_conversation(
    conversation_id: str,
    request: UpdateConversationRequest,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Update conversation title, model, or pinned status (must be owned by authenticated user)."""
    user_id = user_id or DEFAULT_DEV_USER
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if request.title is not None:
        conversation.title = request.title
    if request.model is not None:
        conversation.model = request.model
    if request.pinned is not None:
        conversation.pinned = request.pinned
        conversation.pinned_at = datetime.now() if request.pinned else None

    conversation.updated_at = datetime.now()

    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse.model_validate(conversation)


@router.delete("/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Soft delete a conversation (must be owned by authenticated user)."""
    user_id = user_id or DEFAULT_DEV_USER
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.deleted_at = datetime.now()
    await db.commit()

    return {"message": "Conversation deleted successfully"}


@router.post("/{conversation_id}/pin", response_model=ConversationResponse)
async def toggle_pin_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle pin status of a conversation (must be owned by authenticated user)."""
    user_id = user_id or DEFAULT_DEV_USER
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation.pinned = not conversation.pinned
    conversation.pinned_at = datetime.now() if conversation.pinned else None
    conversation.updated_at = datetime.now()

    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse.model_validate(conversation)


@router.get("/{conversation_id}/messages", response_model=list[MessageResponse])
async def get_messages(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all messages for a conversation (must be owned by authenticated user)."""
    user_id = user_id or DEFAULT_DEV_USER
    # Verify conversation exists and is owned by user
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get messages
    stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.created_at.asc())
    result = await db.execute(stmt)
    messages = list(result.scalars().all())

    return [MessageResponse.model_validate(msg) for msg in messages]


@router.get("/{conversation_id}/draft", response_model=DraftResponse)
async def get_draft(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Get draft for a conversation (user-specific)."""
    user_id = user_id or DEFAULT_DEV_USER
    stmt = select(ConversationDraft).where(
        ConversationDraft.conversation_id == conversation_id,
        # ConversationDraft.user_id == user_id  # Disabled for dev
    )
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()

    if not draft:
        return DraftResponse(content="")

    return DraftResponse(content=draft.content)


@router.put("/{conversation_id}/draft")
async def save_draft(
    conversation_id: str,
    request: DraftRequest,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Save or update draft for a conversation (user-specific)."""
    user_id = user_id or DEFAULT_DEV_USER
    # Verify conversation exists and is owned by user
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check if draft exists for this user
    stmt = select(ConversationDraft).where(
        ConversationDraft.conversation_id == conversation_id,
        # ConversationDraft.user_id == user_id  # Disabled for dev
    )
    result = await db.execute(stmt)
    draft = result.scalar_one_or_none()

    if draft:
        draft.content = request.content
        draft.updated_at = datetime.now()
    else:
        draft = ConversationDraft(
            conversation_id=conversation_id,
            # user_id=user_id,  # Disabled for dev - model doesn't have user_id
            content=request.content,
        )
        db.add(draft)

    await db.commit()

    return {"message": "Draft saved successfully"}


@router.delete("/{conversation_id}/draft")
async def delete_draft(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete draft for a conversation (user-specific)."""
    user_id = user_id or DEFAULT_DEV_USER
    stmt = sql_delete(ConversationDraft).where(
        ConversationDraft.conversation_id == conversation_id,
        # ConversationDraft.user_id == user_id  # Disabled for dev
    )
    await db.execute(stmt)
    await db.commit()

    return {"message": "Draft deleted successfully"}


@router.post("/{conversation_id}/auto-title", response_model=ConversationResponse)
async def auto_title_conversation(
    conversation_id: str,
    user_id: Optional[str] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate and set an automatic title for a conversation based on its first user message (must be owned by authenticated user)."""
    user_id = user_id or DEFAULT_DEV_USER
    # Get conversation
    stmt = select(Conversation).where(
        Conversation.id == conversation_id,
        # Conversation.user_id == user_id,  # Disabled for dev
        Conversation.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    conversation = result.scalar_one_or_none()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Get first user message
    stmt = select(Message).where(
        Message.conversation_id == conversation_id,
        Message.role == "user"
    ).order_by(Message.created_at.asc()).limit(1)
    result = await db.execute(stmt)
    first_message = result.scalar_one_or_none()

    if not first_message:
        raise HTTPException(status_code=400, detail="No user messages found in conversation")

    # Generate title
    title = await generate_title(first_message.content)

    # Update conversation
    conversation.title = title
    conversation.auto_titled = True
    conversation.updated_at = datetime.now()

    await db.commit()
    await db.refresh(conversation)

    return ConversationResponse.model_validate(conversation)
