"""OpenAI provider for GPT-5.2 and other OpenAI models."""

from __future__ import annotations

import logging
from typing import AsyncIterator

from openai import AsyncOpenAI

from .base import ModelProvider, StreamEvent

logger = logging.getLogger(__name__)


class OpenAIProvider(ModelProvider):
    """Provider for OpenAI GPT models.

    Supports GPT-5.2 with reasoning_effort for thinking tokens.
    """

    model_id = "gpt-5.2"
    supports_thinking = True

    def __init__(self, model_id: str = "gpt-5.2"):
        self.model_id = model_id
        self.client = AsyncOpenAI()

    async def stream_response(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        thinking_enabled: bool = True,
        **kwargs,
    ) -> AsyncIterator[StreamEvent]:
        """Stream response from OpenAI API.

        GPT-5.2 thinking is controlled via reasoning_effort parameter.
        """
        full_messages = []
        if system_prompt:
            full_messages.append({"role": "system", "content": system_prompt})
        full_messages.extend(messages)

        # Build request parameters
        request_params = {
            "model": self.model_id,
            "messages": full_messages,
            "stream": True,
        }

        # Add thinking/reasoning support for compatible models
        if thinking_enabled and self.supports_thinking:
            request_params["reasoning_effort"] = kwargs.get("reasoning_effort", "medium")

        try:
            stream = await self.client.chat.completions.create(**request_params)

            async for chunk in stream:
                # Handle reasoning/thinking content (GPT-5.2)
                if hasattr(chunk, "reasoning_content") and chunk.reasoning_content:
                    yield StreamEvent(
                        type="thinking",
                        content=chunk.reasoning_content,
                    )

                # Handle standard content
                if chunk.choices and chunk.choices[0].delta.content:
                    yield StreamEvent(
                        type="content",
                        content=chunk.choices[0].delta.content,
                    )

            yield StreamEvent(type="done")

        except Exception as e:
            logger.error(f"OpenAI streaming error: {e}")
            yield StreamEvent(
                type="error",
                content=str(e),
                metadata={"provider": "openai", "model": self.model_id},
            )

    async def health_check(self) -> bool:
        """Check OpenAI API availability."""
        try:
            # Simple models list call to verify API key and connectivity
            await self.client.models.list()
            return True
        except Exception as e:
            logger.warning(f"OpenAI health check failed: {e}")
            return False
