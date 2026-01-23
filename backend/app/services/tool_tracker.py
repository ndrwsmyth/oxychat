"""Service for tracking tool usage (@mentions, RAG, etc.) during chat interactions."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.database import RetrievalResult, ToolCall


class ToolTracker:
    """Tracks tool calls and retrievals for a specific turn."""

    def __init__(self, db: AsyncSession, turn_id: uuid.UUID):
        """
        Initialize tool tracker for a turn.

        Args:
            db: Database session
            turn_id: ID of the turn to track tools for
        """
        self.db = db
        self.turn_id = turn_id

    async def track_mention(
        self,
        mentions: list[dict[str, Any]],
        context_sources: list[dict[str, Any]],
        message_id: Optional[uuid.UUID] = None,
    ) -> ToolCall:
        """
        Track @mention tool usage.

        Args:
            mentions: List of mention dictionaries from request
            context_sources: List of resolved context sources (transcript metadata)
            message_id: Optional message ID to link this tool call to

        Returns:
            Created ToolCall record
        """
        tool_call = ToolCall(
            id=uuid.uuid4(),
            message_id=message_id,
            turn_id=self.turn_id,
            tool_name="mention",
            input={
                "mentions": mentions,
                "mention_count": len(mentions),
            },
            output={
                "sources": context_sources,
                "source_count": len(context_sources),
            },
            status="success",
            started_at=datetime.now(),
            completed_at=datetime.now(),
        )

        self.db.add(tool_call)
        await self.db.commit()
        await self.db.refresh(tool_call)

        return tool_call

    async def track_rag(
        self,
        query: str,
        results: list[dict[str, Any]],
        retrieval_method: str = "chromadb",
        message_id: Optional[uuid.UUID] = None,
        latency_ms: Optional[int] = None,
    ) -> tuple[ToolCall, RetrievalResult]:
        """
        Track RAG retrieval tool usage.

        Args:
            query: The search query used for RAG
            results: List of retrieved document chunks
            retrieval_method: Method used ('chromadb', 'vector_search', etc.)
            message_id: Optional message ID to link this tool call to
            latency_ms: Optional latency in milliseconds

        Returns:
            Tuple of (ToolCall, RetrievalResult) records
        """
        # Create tool call record
        tool_call = ToolCall(
            id=uuid.uuid4(),
            message_id=message_id,
            turn_id=self.turn_id,
            tool_name="rag",
            input={
                "query": query,
                "retrieval_method": retrieval_method,
            },
            output={
                "results": results,
                "result_count": len(results),
            },
            status="success",
            latency_ms=latency_ms,
            started_at=datetime.now(),
            completed_at=datetime.now(),
        )

        self.db.add(tool_call)

        # Create retrieval result record for debugging/analysis
        retrieval_result = RetrievalResult(
            id=uuid.uuid4(),
            turn_id=self.turn_id,
            tool_call_id=tool_call.id,
            query=query,
            results=results,
            retrieval_method=retrieval_method,
        )

        self.db.add(retrieval_result)

        await self.db.commit()
        await self.db.refresh(tool_call)
        await self.db.refresh(retrieval_result)

        return tool_call, retrieval_result

    async def track_error(
        self,
        tool_name: str,
        input_data: dict[str, Any],
        error_message: str,
        message_id: Optional[uuid.UUID] = None,
        latency_ms: Optional[int] = None,
    ) -> ToolCall:
        """
        Track a failed tool call.

        Args:
            tool_name: Name of the tool that failed
            input_data: Input parameters that were attempted
            error_message: Error message
            message_id: Optional message ID to link this tool call to
            latency_ms: Optional latency in milliseconds

        Returns:
            Created ToolCall record with error status
        """
        tool_call = ToolCall(
            id=uuid.uuid4(),
            message_id=message_id,
            turn_id=self.turn_id,
            tool_name=tool_name,
            input=input_data,
            output=None,
            status="error",
            error_message=error_message,
            latency_ms=latency_ms,
            started_at=datetime.now(),
            completed_at=datetime.now(),
        )

        self.db.add(tool_call)
        await self.db.commit()
        await self.db.refresh(tool_call)

        return tool_call

    async def track_custom_tool(
        self,
        tool_name: str,
        input_data: dict[str, Any],
        output_data: dict[str, Any],
        message_id: Optional[uuid.UUID] = None,
        latency_ms: Optional[int] = None,
        status: str = "success",
        error_message: Optional[str] = None,
    ) -> ToolCall:
        """
        Track usage of a custom tool (future extensibility).

        Args:
            tool_name: Name of the tool (e.g., 'web_search', 'code_exec', 'image_gen')
            input_data: Input parameters
            output_data: Output/results
            message_id: Optional message ID to link this tool call to
            latency_ms: Optional latency in milliseconds
            status: Tool call status ('success', 'error', 'pending')
            error_message: Optional error message if status is 'error'

        Returns:
            Created ToolCall record
        """
        tool_call = ToolCall(
            id=uuid.uuid4(),
            message_id=message_id,
            turn_id=self.turn_id,
            tool_name=tool_name,
            input=input_data,
            output=output_data,
            status=status,
            error_message=error_message,
            latency_ms=latency_ms,
            started_at=datetime.now(),
            completed_at=datetime.now() if status != "pending" else None,
        )

        self.db.add(tool_call)
        await self.db.commit()
        await self.db.refresh(tool_call)

        return tool_call
