"""Anthropic provider for Claude models."""

from __future__ import annotations

import logging
import os
from typing import AsyncIterator

from .base import ModelProvider, StreamEvent

logger = logging.getLogger(__name__)

# Lazy import to avoid requiring anthropic SDK if not used
_anthropic_client = None


def get_anthropic_client():
    """Lazily initialize Anthropic client."""
    global _anthropic_client
    if _anthropic_client is None:
        try:
            import anthropic
            _anthropic_client = anthropic.AsyncAnthropic()
        except ImportError:
            raise ImportError(
                "anthropic package not installed. Run: uv add anthropic"
            )
    return _anthropic_client


class AnthropicProvider(ModelProvider):
    """Provider for Anthropic Claude models.

    Supports Claude Sonnet 4.5 and Opus 4.5 with extended thinking.
    """

    model_id = "claude-sonnet-4.5"
    supports_thinking = True

    # Map friendly names to API model IDs
    MODEL_MAP = {
        "claude-sonnet-4.5": "claude-sonnet-4-5-20250929",
        "claude-opus-4.5": "claude-opus-4-5-20251101",
    }

    def __init__(self, model_id: str = "claude-sonnet-4.5"):
        self.model_id = model_id
        self._api_model = self.MODEL_MAP.get(model_id, model_id)

    async def stream_response(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        thinking_enabled: bool = True,
        **kwargs,
    ) -> AsyncIterator[StreamEvent]:
        """Stream response from Anthropic API.

        Claude thinking is enabled via the 'thinking' parameter.
        """
        client = get_anthropic_client()

        # Build request parameters
        request_params = {
            "model": self._api_model,
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", 8192),
        }

        # Add system prompt if provided
        if system_prompt:
            request_params["system"] = system_prompt

        # Add thinking support
        if thinking_enabled and self.supports_thinking:
            budget = kwargs.get("thinking_budget", 4096)
            request_params["thinking"] = {
                "type": "enabled",
                "budget_tokens": budget,
            }

        try:
            async with client.messages.stream(**request_params) as stream:
                in_thinking_block = False

                async for event in stream:
                    event_type = getattr(event, "type", None)

                    if event_type == "content_block_start":
                        block = getattr(event, "content_block", None)
                        if block and getattr(block, "type", None) == "thinking":
                            in_thinking_block = True
                            yield StreamEvent(
                                type="thinking_start",
                                metadata={"block_type": "thinking"},
                            )

                    elif event_type == "content_block_delta":
                        delta = getattr(event, "delta", None)
                        if delta:
                            # Check for thinking content
                            thinking = getattr(delta, "thinking", None)
                            if thinking:
                                yield StreamEvent(type="thinking", content=thinking)
                            # Check for text content
                            text = getattr(delta, "text", None)
                            if text:
                                yield StreamEvent(type="content", content=text)

                    elif event_type == "content_block_stop":
                        if in_thinking_block:
                            in_thinking_block = False
                            yield StreamEvent(type="thinking_end")

            yield StreamEvent(type="done")

        except Exception as e:
            logger.error(f"Anthropic streaming error: {e}")
            yield StreamEvent(
                type="error",
                content=str(e),
                metadata={"provider": "anthropic", "model": self.model_id},
            )

    async def health_check(self) -> bool:
        """Check Anthropic API availability."""
        # Check if API key is configured
        if not os.getenv("ANTHROPIC_API_KEY"):
            logger.warning("ANTHROPIC_API_KEY not set")
            return False
        return True
