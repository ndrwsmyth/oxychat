"""Chat service handling OpenAI streaming responses."""

from __future__ import annotations

import json
import logging
from typing import AsyncIterator

from openai import AsyncOpenAI

from ..constants import INSTRUCTIONS, MODEL

logger = logging.getLogger(__name__)


class ChatService:
    """Handles chat completions with streaming via OpenAI API."""

    def __init__(self) -> None:
        self.client = AsyncOpenAI()
        self.model = MODEL
        self.instructions = INSTRUCTIONS

    async def stream_response(
        self,
        messages: list[dict],
        context: str | None = None,
    ) -> AsyncIterator[str]:
        """
        Stream a chat response.

        Yields SSE-formatted chunks: data: {"type": "content", "content": "..."}\n\n

        Args:
            messages: List of message dicts with 'role' and 'content'
            context: Optional context string to append to system message
        """
        system_message = self.instructions
        if context:
            system_message += f"\n\n{context}"

        full_messages = [
            {"role": "system", "content": system_message},
            *messages,
        ]

        try:
            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=True,
            )

            async for chunk in stream:
                if chunk.choices and chunk.choices[0].delta.content:
                    content = chunk.choices[0].delta.content
                    yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.error(f"Error streaming chat response: {e}")
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"


# Singleton instance
chat_service = ChatService()
