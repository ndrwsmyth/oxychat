"""Model provider adapters for multi-model support.

This module provides thin wrappers around LLM APIs (OpenAI, Anthropic, xAI)
with unified request/response format, streaming normalization, and error handling.
"""

from .base import ModelProvider, ProviderRegistry, StreamEvent
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider
from .xai_provider import XAIProvider

__all__ = [
    # Base classes
    "ModelProvider",
    "ProviderRegistry",
    "StreamEvent",
    # Providers
    "OpenAIProvider",
    "AnthropicProvider",
    "XAIProvider",
]


def register_default_providers() -> None:
    """Register all default model providers.

    Call this at application startup to initialize the provider registry.
    """
    # OpenAI / GPT models
    ProviderRegistry.register(OpenAIProvider("gpt-5.2"))

    # Anthropic / Claude models
    ProviderRegistry.register(AnthropicProvider("claude-sonnet-4.5"))
    ProviderRegistry.register(AnthropicProvider("claude-opus-4.5"))

    # xAI / Grok models
    ProviderRegistry.register(XAIProvider("grok-4"))
