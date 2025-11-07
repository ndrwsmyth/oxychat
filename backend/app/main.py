"""FastAPI entrypoint wiring the ChatKit server and REST endpoints."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from chatkit.server import StreamingResult
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse

# Load environment variables from .env file
load_dotenv(Path(__file__).parent.parent / ".env")

from .chat import (
    AgentControllerServer,
    create_chatkit_server,
)
from .database import get_db, get_recent_meetings, init_db
from .webhook import router as webhook_router

app = FastAPI(title="ChatKit API")

# Register webhook router
app.include_router(webhook_router, prefix="/webhook", tags=["webhook"])


@app.on_event("startup")
async def startup_event() -> None:
    """Initialize database on startup."""
    await init_db()

_chatkit_server: AgentControllerServer | None = create_chatkit_server()


def get_chatkit_server() -> AgentControllerServer:
    if _chatkit_server is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "ChatKit dependencies are missing. Install the ChatKit Python "
                "package to enable the conversational endpoint."
            ),
        )
    return _chatkit_server


@app.post("/chatkit")
async def chatkit_endpoint(
    request: Request, server: AgentControllerServer = Depends(get_chatkit_server)
) -> Response:
    payload = await request.body()
    result = await server.process(payload, {"request": request})
    if isinstance(result, StreamingResult):
        return StreamingResponse(result, media_type="text/event-stream")
    if hasattr(result, "json"):
        return Response(content=result.json, media_type="application/json")
    return JSONResponse(result)




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
    return {"status": "healthy"}


@app.get("/api/meetings/recent")
async def get_recent_meetings_endpoint(
    limit: int = 10, db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """Get the most recent meetings."""
    meetings = await get_recent_meetings(db, limit=limit)
    return {
        "meetings": [
            {"id": meeting.doc_id, "title": meeting.title, "date": meeting.date}
            for meeting in meetings
        ]
    }
