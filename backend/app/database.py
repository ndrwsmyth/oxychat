from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / ".env")

DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")
if not DATABASE_URL:
    import logging

    logging.getLogger(__name__).warning(
        "SUPABASE_DATABASE_URL not set. Database features will be unavailable. "
        "Get your connection string from Supabase Dashboard → Settings → Database → Connection Pooling → Direct Connection"
    )
    DATABASE_URL = None


class Base(DeclarativeBase):
    pass


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    meeting_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    doc_id: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(Text, nullable=False, index=True)
    date: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    attendees: Mapped[dict] = mapped_column(JSON, nullable=False)
    transcript: Mapped[dict] = mapped_column(JSON, nullable=False)
    raw_payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    formatted_content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(String(100), nullable=False, default="circleback")
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("meeting_id", name="uq_meeting_id"),
        UniqueConstraint("doc_id", name="uq_doc_id"),
        Index("idx_date", "date"),
        Index("idx_title", "title"),
    )


# Create async engine for Supabase (if URL is configured)
engine = None
async_session_maker = None

if DATABASE_URL:
    # SSL is handled automatically by asyncpg when connecting to Supabase
    engine = create_async_engine(DATABASE_URL, echo=False)
    # Create async session factory
    async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db() -> None:
    """Initialize database by creating all tables."""
    if not engine:
        import logging

        logging.getLogger(__name__).warning("Database not configured, skipping initialization")
        return

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as e:
        import logging

        logger = logging.getLogger(__name__)
        logger.error(f"Failed to initialize database: {e}")
        logger.error(f"Database URL: {DATABASE_URL}")
        raise


async def get_db() -> AsyncSession:
    """Dependency for FastAPI routes to get database session."""
    if not async_session_maker:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=503,
            detail="Database not configured. Set SUPABASE_DATABASE_URL environment variable.",
        )
    async with async_session_maker() as session:
        yield session


async def save_meeting(session: AsyncSession, meeting_data: dict) -> Meeting:
    """Insert or update a meeting in the database."""
    import logging

    logger = logging.getLogger(__name__)

    # Check if meeting exists by meeting_id
    from sqlalchemy import select

    meeting_id = meeting_data.get("meeting_id", "unknown")
    logger.debug(f"Checking for existing meeting with meeting_id: {meeting_id}")

    stmt = select(Meeting).where(Meeting.meeting_id == meeting_data["meeting_id"])
    result = await session.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        logger.info(f"Updating existing meeting (DB ID: {existing.id}, meeting_id: {meeting_id})")
        # Update existing meeting
        for key, value in meeting_data.items():
            setattr(existing, key, value)
        existing.updated_at = datetime.now()
        await session.commit()
        await session.refresh(existing)
        logger.info(f"Successfully updated meeting (DB ID: {existing.id})")
        return existing
    else:
        logger.info(f"Inserting new meeting (meeting_id: {meeting_id})")
        # Insert new meeting
        new_meeting = Meeting(**meeting_data)
        session.add(new_meeting)
        await session.commit()
        await session.refresh(new_meeting)
        logger.info(
            f"Successfully inserted meeting (DB ID: {new_meeting.id}, meeting_id: {meeting_id})"
        )
        return new_meeting


async def get_meeting_by_doc_id(session: AsyncSession, doc_id: str) -> Optional[Meeting]:
    """Retrieve a meeting by doc_id."""
    from sqlalchemy import select

    stmt = select(Meeting).where(Meeting.doc_id == doc_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_recent_meetings(session: AsyncSession, limit: int = 10) -> list[Meeting]:
    """Get the most recent meetings sorted by date descending."""
    from sqlalchemy import select

    stmt = select(Meeting).order_by(Meeting.date.desc(), Meeting.created_at.desc()).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    auto_titled: Mapped[bool] = mapped_column(Boolean, default=False)
    user_renamed: Mapped[bool] = mapped_column(
        Boolean, default=False
    )  # True if user manually renamed
    model: Mapped[str] = mapped_column(String(100), default="claude-sonnet-4.5")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    pinned_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_conversations_updated_at", "updated_at"),
        Index("idx_conversations_pinned", "pinned", "pinned_at"),
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turn_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("turns.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    mentions: Mapped[dict] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_messages_conversation_id", "conversation_id", "created_at"),
        Index("idx_messages_turn_id", "turn_id"),
    )


class ConversationDraft(Base):
    __tablename__ = "conversation_drafts"

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        primary_key=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class Profile(Base):
    """Extended user profile linked to Supabase auth.users"""

    __tablename__ = "profiles"

    id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True), primary_key=True
    )  # UUID from auth.users
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    org_id: Mapped[Optional[uuid.UUID]] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    profile_metadata: Mapped[dict] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("idx_profiles_email", "email"),
        Index("idx_profiles_org_id", "org_id"),
    )


class Turn(Base):
    """Groups messages in a single exchange (user message + assistant response)"""

    __tablename__ = "turns"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("idx_turns_conversation_id", "conversation_id", "sequence"),
        UniqueConstraint("conversation_id", "sequence", name="uq_conversation_sequence"),
    )


class ToolCall(Base):
    """Tracks tool usage (@mentions, RAG, future tools)"""

    __tablename__ = "tool_calls"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    turn_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("turns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tool_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    input: Mapped[dict] = mapped_column(JSON, nullable=False)
    output: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    latency_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Indexes defined via index=True on columns above


class AgentStep(Base):
    """Tracks multi-step reasoning for advanced agent behaviors"""

    __tablename__ = "agent_steps"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    turn_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("turns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    step_type: Mapped[str] = mapped_column(String(50), nullable=False)
    input_context: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    output: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tokens_in: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (Index("idx_agent_steps_turn_id", "turn_id", "sequence"),)


class RetrievalResult(Base):
    """Tracks RAG retrievals for debugging and improvement"""

    __tablename__ = "retrieval_results"

    id: Mapped[uuid.UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    turn_id: Mapped[uuid.UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("turns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tool_call_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("tool_calls.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    results: Mapped[dict] = mapped_column(JSON, nullable=False)
    retrieval_method: Mapped[str] = mapped_column(String(50), default="chromadb")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Indexes defined via index=True on columns above
