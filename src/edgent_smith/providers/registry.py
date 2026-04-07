"""Provider registry – maps ModelProvider enum to concrete adapter classes."""

from __future__ import annotations

from edgent_smith.config.settings import ModelProvider, Settings, get_settings
from edgent_smith.providers.base import ModelProviderBase, ProviderConfig
from edgent_smith.providers.ollama import OllamaProvider


def get_provider(settings: Settings | None = None) -> ModelProviderBase:
    """Instantiate and return the configured model provider."""
    if settings is None:
        settings = get_settings()

    config = ProviderConfig(
        provider_name=settings.model_provider.value,
        model_name=settings.model_name,
        base_url=settings.ollama_base_url,
        max_tokens=settings.max_tokens,
        timeout_seconds=settings.timeout_seconds,
    )

    match settings.model_provider:
        case ModelProvider.OLLAMA:
            return OllamaProvider(config)
        case _:
            raise NotImplementedError(
                f"Provider '{settings.model_provider}' is not yet implemented. "
                "Contributions welcome – see src/edgent_smith/providers/"
            )
