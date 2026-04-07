"""Unit tests for provider registry."""

import pytest

from edgent_smith.config.settings import ModelProvider, Settings
from edgent_smith.providers import OllamaProvider, get_provider


def test_get_ollama_provider():
    s = Settings(model_provider=ModelProvider.OLLAMA)
    provider = get_provider(s)
    assert isinstance(provider, OllamaProvider)
    assert provider.provider_name == "ollama"


def test_ollama_model_string():
    s = Settings(model_provider=ModelProvider.OLLAMA, model_name="gemma3:4b")
    provider = get_provider(s)
    assert provider.get_pydantic_ai_model() == "ollama:gemma3:4b"


def test_unsupported_provider_raises():
    s = Settings(model_provider=ModelProvider.OPENAI)
    with pytest.raises(NotImplementedError):
        get_provider(s)
