"""FastAPI entrypoint for OxyChat backend."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / ".env")

from .database import get_db, get_recent_meetings, init_db
from .routers import chat_router, transcripts_router
from .webhook import router as webhook_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="OxyChat API",
    description="AI-powered chat with meeting transcript context",
    version="1.0.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat_router)
app.include_router(transcripts_router)
app.include_router(webhook_router, prefix="/webhook", tags=["webhook"])


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize database on startup."""
    logger.info("Starting OxyChat API...")
    try:
        await init_db()
        logger.info("Database initialized")
    except Exception as e:
        logger.warning(f"Database initialization failed: {e}")
        logger.warning("Running without database - some features will be unavailable")


@app.get("/")
async def root() -> dict[str, str]:
    """Root endpoint with API info."""
    return {
        "name": "OxyChat API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.post("/")
async def root_post() -> dict[str, str]:
    """Catch misconfigured webhook requests sent to root."""
    return {
        "error": "Webhook endpoint not found",
        "message": "POST requests should be sent to /webhook/circleback",
        "correct_endpoint": "/webhook/circleback",
    }


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy"}


# Legacy endpoint for backwards compatibility
# TODO: Remove once frontend is fully migrated
@app.get("/api/meetings/recent")
async def get_recent_meetings_endpoint(
    limit: int = 10,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get the most recent meetings.

    Deprecated: Use GET /api/transcripts instead.
    """
    meetings = await get_recent_meetings(db, limit=limit)
    return {
        "meetings": [
            {"id": meeting.doc_id, "title": meeting.title, "date": meeting.date}
            for meeting in meetings
        ]
    }
