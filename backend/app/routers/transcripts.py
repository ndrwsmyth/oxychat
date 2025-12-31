"""Transcripts API router for CRUD operations."""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import (
    get_db,
    get_meeting_by_doc_id,
    get_recent_meetings,
    save_meeting,
)
from ..services.vector_store import get_vector_store

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/transcripts", tags=["transcripts"])


class TranscriptResponse(BaseModel):
    """Basic transcript info for list views."""

    id: str
    title: str
    date: str
    source: str
    summary: Optional[str] = None


class TranscriptDetailResponse(TranscriptResponse):
    """Full transcript details including content."""

    content: str
    attendees: list[dict]


class ManualUploadRequest(BaseModel):
    """Request body for manual transcript upload."""

    title: str
    date: str
    content: str  # Raw markdown or plain text


@router.get("")
async def list_transcripts(
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    List all transcripts, sorted by date descending.

    Args:
        limit: Maximum number of transcripts to return (default 20)
    """
    meetings = await get_recent_meetings(db, limit=limit)
    logger.info(f"Listing {len(meetings)} transcripts")

    return {
        "transcripts": [
            TranscriptResponse(
                id=m.doc_id,
                title=m.title,
                date=m.date,
                source=m.source,
            ).model_dump()
            for m in meetings
        ]
    }


@router.get("/{doc_id}")
async def get_transcript(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
) -> TranscriptDetailResponse:
    """
    Get a single transcript by ID.

    Args:
        doc_id: The document ID (e.g., "doc_123")
    """
    meeting = await get_meeting_by_doc_id(db, doc_id)
    if not meeting:
        logger.warning(f"Transcript not found: {doc_id}")
        raise HTTPException(status_code=404, detail="Transcript not found")

    logger.info(f"Retrieved transcript: {doc_id}")

    return TranscriptDetailResponse(
        id=meeting.doc_id,
        title=meeting.title,
        date=meeting.date,
        source=meeting.source,
        content=meeting.formatted_content,
        attendees=meeting.attendees if isinstance(meeting.attendees, list) else [],
    )


@router.post("")
async def upload_transcript(
    request: ManualUploadRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> TranscriptResponse:
    """
    Upload a transcript manually.

    Creates a new transcript entry with the provided title, date, and content,
    and auto-embeds it into the vector store for RAG search.
    """
    # Generate unique meeting_id for manual uploads
    meeting_id = int(uuid.uuid4().int % 10**9)  # 9-digit unique ID
    doc_id = f"doc_{meeting_id}"

    meeting_data = {
        "meeting_id": meeting_id,
        "doc_id": doc_id,
        "title": request.title,
        "date": request.date,
        "attendees": [],
        "transcript": [],
        "raw_payload": {"manual_upload": True, "source": "web_ui"},
        "formatted_content": request.content,
        "source": "manual",
        "processed": True,
    }

    meeting = await save_meeting(db, meeting_data)
    logger.info(f"Created manual transcript: {doc_id} - {request.title}")

    # Auto-embed into vector store (background task)
    def embed_background():
        try:
            vector_store = get_vector_store()
            chunks = vector_store.add_transcript(
                doc_id=meeting.doc_id,
                title=meeting.title,
                date=meeting.date,
                content=meeting.formatted_content,
            )
            logger.info(f"Auto-embedded manual transcript {doc_id} into {chunks} chunks")
        except Exception as e:
            logger.error(f"Failed to auto-embed manual transcript {doc_id}: {e}")

    background_tasks.add_task(embed_background)

    return TranscriptResponse(
        id=meeting.doc_id,
        title=meeting.title,
        date=meeting.date,
        source=meeting.source,
    )


@router.delete("/{doc_id}")
async def delete_transcript(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """
    Delete a transcript by ID.

    Args:
        doc_id: The document ID (e.g., "doc_123")
    """
    from sqlalchemy import delete
    from ..database import Meeting

    meeting = await get_meeting_by_doc_id(db, doc_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Transcript not found")

    stmt = delete(Meeting).where(Meeting.doc_id == doc_id)
    await db.execute(stmt)
    await db.commit()

    # Also remove from vector store
    try:
        vector_store = get_vector_store()
        vector_store.delete_transcript(doc_id)
    except Exception as e:
        logger.warning(f"Failed to delete from vector store: {e}")

    logger.info(f"Deleted transcript: {doc_id}")

    return {"status": "deleted", "doc_id": doc_id}


class SearchRequest(BaseModel):
    """Request body for transcript search."""

    query: str
    n_results: int = 5
    doc_ids: Optional[list[str]] = None


class SearchResult(BaseModel):
    """Single search result."""

    doc_id: str
    title: str
    date: str
    content: str
    distance: float


@router.post("/search")
async def search_transcripts(request: SearchRequest) -> dict[str, Any]:
    """
    Search transcripts using semantic similarity.

    Args:
        query: Search query
        n_results: Maximum number of results
        doc_ids: Optional list of doc_ids to filter by (for @mentions)
    """
    try:
        vector_store = get_vector_store()
        results = vector_store.search(
            query=request.query,
            n_results=request.n_results,
            doc_ids=request.doc_ids,
        )

        return {
            "results": [
                SearchResult(
                    doc_id=r["doc_id"],
                    title=r["title"],
                    date=r["date"],
                    content=r["content"],
                    distance=r["distance"],
                ).model_dump()
                for r in results
            ]
        }
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post("/{doc_id}/embed")
async def embed_transcript(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Embed a transcript into the vector store.

    This creates vector embeddings for the transcript content,
    enabling semantic search.
    """
    meeting = await get_meeting_by_doc_id(db, doc_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Transcript not found")

    try:
        vector_store = get_vector_store()
        num_chunks = vector_store.add_transcript(
            doc_id=meeting.doc_id,
            title=meeting.title,
            date=meeting.date,
            content=meeting.formatted_content,
        )

        logger.info(f"Embedded transcript {doc_id} into {num_chunks} chunks")

        return {
            "status": "embedded",
            "doc_id": doc_id,
            "chunks": num_chunks,
        }
    except Exception as e:
        logger.error(f"Embedding error for {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding failed: {str(e)}")


@router.post("/embed-all")
async def embed_all_transcripts(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Embed all transcripts into the vector store.

    This runs in the background and returns immediately.
    """
    meetings = await get_recent_meetings(db, limit=1000)

    if not meetings:
        return {"status": "no_transcripts", "count": 0}

    def embed_all():
        vector_store = get_vector_store()
        total_chunks = 0
        for meeting in meetings:
            try:
                chunks = vector_store.add_transcript(
                    doc_id=meeting.doc_id,
                    title=meeting.title,
                    date=meeting.date,
                    content=meeting.formatted_content,
                )
                total_chunks += chunks
            except Exception as e:
                logger.error(f"Failed to embed {meeting.doc_id}: {e}")
        logger.info(f"Finished embedding {len(meetings)} transcripts ({total_chunks} chunks)")

    background_tasks.add_task(embed_all)

    return {
        "status": "started",
        "count": len(meetings),
        "message": "Embedding started in background",
    }


@router.get("/vector-stats")
async def get_vector_stats() -> dict[str, Any]:
    """Get statistics about the vector store."""
    try:
        vector_store = get_vector_store()
        stats = vector_store.get_stats()
        return stats
    except Exception as e:
        logger.error(f"Failed to get vector stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")
