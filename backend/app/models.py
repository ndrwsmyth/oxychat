from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Meeting(BaseModel):
    """Pydantic model for meeting data, compatible with database schema."""

    id: Optional[int] = None
    meeting_id: int
    doc_id: str
    title: str
    date: str
    attendees: list[dict]
    transcript: list[dict]
    raw_payload: dict
    formatted_content: str
    source: str = "circleback"
    processed: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


