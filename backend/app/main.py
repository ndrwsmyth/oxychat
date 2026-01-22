"""FastAPI entrypoint for OxyChat backend."""

from __future__ import annotations

import logging
import os
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
from .routers.conversations import router as conversations_router
# NOTE: search_router disabled - requires Conversation.user_id, title_tsv, Message.content_tsv columns
# from .routers.search import router as search_router
# NOTE: messages_router disabled - requires Message.parent_message_id, version columns
# from .routers.messages import router as messages_router
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

# CORS configuration - use ALLOWED_ORIGINS env var in production
# Format: comma-separated URLs, e.g., "https://app.example.com,https://staging.example.com"
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if allowed_origins_env:
    allowed_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
    logger.info(f"CORS configured for origins: {allowed_origins}")
else:
    # Default to allow all for local development
    allowed_origins = ["*"]
    logger.warning("CORS: No ALLOWED_ORIGINS set, allowing all origins (development mode)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(chat_router)
app.include_router(transcripts_router)
app.include_router(conversations_router)
# app.include_router(search_router)  # Disabled - missing DB columns
# app.include_router(messages_router)  # Disabled - missing DB columns
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
async def health_check() -> dict[str, Any]:
    """Health check endpoint with service status."""
    import os

    # Check for required API keys
    openai_configured = bool(os.getenv("OPENAI_API_KEY"))
    anthropic_configured = bool(os.getenv("ANTHROPIC_API_KEY"))
    db_configured = bool(os.getenv("SUPABASE_DATABASE_URL"))

    return {
        "status": "healthy",
        "version": "1.0.0",
        "services": {
            "openai": "configured" if openai_configured else "not_configured",
            "anthropic": "configured" if anthropic_configured else "not_configured",
            "database": "configured" if db_configured else "not_configured",
        },
    }


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
