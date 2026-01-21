"""Chat service - Orchestration layer for multi-model chat.

This is the orchestration layer that:
1. Receives requests from entry points (routers)
2. Assembles context (@mentions, RAG, system prompt)
3. Routes to the appropriate provider
4. Converts StreamEvents to SSE format for frontend
"""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from ..constants import get_instructions, MODEL
from .providers import ProviderRegistry, StreamEvent, register_default_providers

logger = logging.getLogger(__name__)


class ChatService:
    """Orchestrates chat requests across multiple model providers."""

    def __init__(self) -> None:
        self.default_model = MODEL

        # Register all providers
        register_default_providers()
        logger.info(f"Registered providers: {ProviderRegistry.list_models()}")

    async def stream_response(
        self,
        messages: list[dict],
        context: str | None = None,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        """
        Stream a chat response using the specified model provider.

        Yields SSE-formatted chunks:
        - data: {"type": "thinking_start"}\n\n
        - data: {"type": "thinking", "content": "..."}\n\n
        - data: {"type": "thinking_end"}\n\n
        - data: {"type": "content", "content": "..."}\n\n
        - data: {"type": "done"}\n\n
        - data: {"type": "error", "error": "..."}\n\n

        Args:
            messages: List of message dicts with 'role' and 'content'
            context: Optional context string to append to system message
            model: Model ID to use (defaults to self.default_model)
        """
        model_id = model or self.default_model

        # Build system prompt with context (get fresh instructions with current date)
        system_prompt = get_instructions()
        if context:
            system_prompt += f"\n\n{context}"

        # Get provider for requested model
        try:
            provider = ProviderRegistry.get(model_id)
        except ValueError as e:
            logger.error(f"Provider not found: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
            return

        logger.info(f"Streaming response using {model_id}")

        try:
            # Stream from provider and convert to SSE format
            async for event in provider.stream_response(
                messages=messages,
                system_prompt=system_prompt,
                thinking_enabled=True,
            ):
                yield self._event_to_sse(event)

        except Exception as e:
            logger.error(f"Error streaming chat response: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

    def _event_to_sse(self, event: StreamEvent) -> str:
        """Convert StreamEvent to SSE-formatted string."""
        data = {"type": event.type}

        if event.content is not None:
            data["content"] = event.content

        if event.metadata:
            data["metadata"] = event.metadata

        return f"data: {json.dumps(data)}\n\n"

    def list_available_models(self) -> list[str]:
        """Return list of available model IDs."""
        return ProviderRegistry.list_models()


# Singleton instance
chat_service = ChatService()
