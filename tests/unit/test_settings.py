"""Unit tests for settings module."""

import pytest

from edgent_smith.config.settings import ModelProvider, Settings


def test_default_settings():
    s = Settings()
    assert s.model_provider == ModelProvider.OLLAMA
    assert s.model_name == "gemma3:4b"
    assert s.max_tokens == 512
    assert s.max_retries == 3
    assert s.timeout_seconds == 30.0


def test_settings_from_env(monkeypatch):
    monkeypatch.setenv("EDGENT_MODEL_NAME", "llama3:8b")
    monkeypatch.setenv("EDGENT_MAX_TOKENS", "256")
    s = Settings()
    assert s.model_name == "llama3:8b"
    assert s.max_tokens == 256


def test_max_tokens_bounds():
    with pytest.raises(ValueError):
        Settings(max_tokens=0)
    with pytest.raises(ValueError):
        Settings(max_tokens=99999)
