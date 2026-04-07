"""Ollama model provider adapter."""

from __future__ import annotations

import httpx

from edgent_smith.providers.base import ModelProviderBase, ProviderConfig


class OllamaProvider(ModelProviderBase):
    """Adapter for Ollama local model inference."""

    def __init__(self, config: ProviderConfig) -> None:
        super().__init__(config)
        self._base_url = config.base_url or "http://localhost:11434"

    @property
    def provider_name(self) -> str:
        return "ollama"

    def get_pydantic_ai_model(self) -> str:
        """Return the pydantic-ai model identifier for Ollama."""
        return f"ollama:{self.config.model_name}"

    async def health_check(self) -> bool:
        """Ping the Ollama API to confirm availability."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self._base_url}/api/tags")
                return resp.status_code == 200
        except Exception:
            return False
