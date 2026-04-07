"""Abstract base for model providers."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any


@dataclass
class ProviderConfig:
    """Runtime configuration for a model provider."""

    provider_name: str
    model_name: str
    base_url: str | None = None
    api_key: str | None = None
    max_tokens: int = 512
    timeout_seconds: float = 30.0
    extra: dict[str, Any] | None = None


class ModelProviderBase(ABC):
    """Base class for model provider adapters."""

    def __init__(self, config: ProviderConfig) -> None:
        self.config = config

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the canonical provider name."""

    @abstractmethod
    def get_pydantic_ai_model(self) -> Any:
        """Return a pydantic-ai compatible model object."""

    @abstractmethod
    async def health_check(self) -> bool:
        """Return True if the provider is reachable and healthy."""
