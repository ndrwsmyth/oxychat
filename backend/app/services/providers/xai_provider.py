"""xAI provider for Grok models."""

from __future__ import annotations

import logging
import os
from typing import AsyncIterator

from openai import AsyncOpenAI

from .base import ModelProvider, StreamEvent

logger = logging.getLogger(__name__)


class XAIProvider(ModelProvider):
    """Provider for xAI Grok models.

    Uses OpenAI-compatible API at api.x.ai.
    """

    model_id = "grok-4"
    supports_thinking = True  # Grok supports reasoning

    # xAI API base URL
    BASE_URL = "https://api.x.ai/v1"

    # Map friendly names to API model IDs
    MODEL_MAP = {
        "grok-4": "grok-4-1-fast",
    }

    def __init__(self, model_id: str = "grok-4"):
        self.model_id = model_id
        self._api_model = self.MODEL_MAP.get(model_id, model_id)
        api_key = os.getenv("XAI_API_KEY")
        if api_key:
            self.client = AsyncOpenAI(
                api_key=api_key,
                base_url=self.BASE_URL,
            )
        else:
            self.client = None

    async def stream_response(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        thinking_enabled: bool = True,
        **kwargs,
    ) -> AsyncIterator[StreamEvent]:
        """Stream response from xAI API.

        xAI uses OpenAI-compatible format.
        """
        if not self.client:
            yield StreamEvent(
                type="error",
                content="XAI_API_KEY not configured",
                metadata={"provider": "xai"},
            )
            return

        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        try:
            stream = await self.client.chat.completions.create(
                model=self._api_model,
                messages=full_messages,
                stream=True,
            )

            async for chunk in stream:
                # Handle content chunks
                if chunk.choices and chunk.choices[0].delta.content:
                    yield StreamEvent(
                        type="content",
                        content=chunk.choices[0].delta.content,
                    )

            yield StreamEvent(type="done")

        except Exception as e:
            logger.error(f"xAI streaming error: {e}")
            yield StreamEvent(
                type="error",
                content=str(e),
                metadata={"provider": "xai", "model": self.model_id},
            )

    async def health_check(self) -> bool:
        """Check xAI API availability."""
        if not self.client:
            logger.warning("XAI_API_KEY not set")
            return False
        try:
            # Simple test request
            await self.client.models.list()
            return True
        except Exception as e:
            logger.warning(f"xAI health check failed: {e}")
            return False
