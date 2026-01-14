"""Base classes for model providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import AsyncIterator


@dataclass
class StreamEvent:
    """Unified streaming event format across all providers.

    Event types:
    - thinking_start: Beginning of thinking/reasoning block
    - thinking: Thinking content chunk
    - thinking_end: End of thinking block
    - content: Response content chunk
    - tool_call: Tool invocation event
    - done: Stream complete
    - error: Error occurred
    """
    type: str
    content: str | None = None
    metadata: dict = field(default_factory=dict)


class ModelProvider(ABC):
    """Base class for all model providers.

    Each provider implements a thin wrapper around a specific LLM API,
    normalizing responses to StreamEvent format.
    """

    model_id: str  # e.g., "gpt-5.2", "claude-sonnet-4.5"
    supports_thinking: bool = False

    @abstractmethod
    async def stream_response(
        self,
        messages: list[dict],
        system_prompt: str | None = None,
        thinking_enabled: bool = True,
        **kwargs,
    ) -> AsyncIterator[StreamEvent]:
        """Stream response as normalized events.

        Args:
            messages: List of message dicts with 'role' and 'content'
            system_prompt: Optional system prompt to prepend
            thinking_enabled: Whether to enable thinking/reasoning mode
            **kwargs: Provider-specific options

        Yields:
            StreamEvent objects representing response chunks
        """
        pass

    async def health_check(self) -> bool:
        """Check if provider is available and responding."""
        return True


class ProviderRegistry:
    """Registry to map model IDs to provider instances."""

    _providers: dict[str, ModelProvider] = {}

    @classmethod
    def register(cls, provider: ModelProvider) -> None:
        """Register a provider for its model_id."""
        cls._providers[provider.model_id] = provider

    @classmethod
    def get(cls, model_id: str) -> ModelProvider:
        """Get provider by model ID.

        Raises:
            ValueError: If model_id is not registered
        """
        if model_id not in cls._providers:
            available = ", ".join(cls._providers.keys()) or "none"
            raise ValueError(f"Unknown model: {model_id}. Available: {available}")
        return cls._providers[model_id]

    @classmethod
    def list_models(cls) -> list[str]:
        """List all registered model IDs."""
        return list(cls._providers.keys())

    @classmethod
    def clear(cls) -> None:
        """Clear all registered providers (for testing)."""
        cls._providers.clear()
