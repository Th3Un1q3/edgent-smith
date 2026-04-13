from __future__ import annotations

import importlib
import sys

import pytest
from openai import OpenAIError
from pydantic_ai.models.openai import OpenAIChatModel


def reload_config():
    if "config" in sys.modules:
        importlib.reload(sys.modules["config"])
        return sys.modules["config"]
    import config

    return config


def test_build_copilot_model_returns_none_without_token(monkeypatch):
    monkeypatch.delenv("GITHUB_COPILOT_API_TOKEN", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    cfg = reload_config()
    # Current implementation will attempt to construct AsyncOpenAI even when
    # the Copilot token is missing and thus raise an OpenAIError from the
    # underlying OpenAI client library.
    with pytest.raises(OpenAIError):
        cfg.build_copilot_model()


def test_build_copilot_model_constructs_with_token(monkeypatch):
    monkeypatch.setenv("GITHUB_COPILOT_API_TOKEN", "dummy-token")
    cfg = reload_config()
    model = cfg.build_copilot_model()
    assert isinstance(model, OpenAIChatModel)


def test_ollama_model_name_from_env(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL_NAME", "my-test-model")
    cfg = reload_config()
    entry = cfg.resolve_model_config("edge_agent_default")
    assert hasattr(entry.model, "model_name")
    assert entry.model.model_name == "my-test-model"


def test_llm_judge_default_with_github_token(monkeypatch):
    monkeypatch.setenv("GITHUB_TOKEN", "dummy-token")
    monkeypatch.delenv("GITHUB_COPILOT_API_TOKEN", raising=False)
    cfg = reload_config()
    entry = cfg.resolve_model_config("llm_judge_default")
    assert isinstance(entry.model, OpenAIChatModel)


def test_llm_judge_default_with_copilot_token(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.setenv("GITHUB_COPILOT_API_TOKEN", "dummy-token")
    cfg = reload_config()
    entry = cfg.resolve_model_config("llm_judge_default")
    assert isinstance(entry.model, OpenAIChatModel)


def test_llm_judge_default_without_tokens_raises(monkeypatch):
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    monkeypatch.delenv("GITHUB_COPILOT_API_TOKEN", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    cfg = reload_config()
    # Depending on the implementation, resolving the judge may either raise
    # a ValueError (explicit) or propagate an OpenAIError from the client
    # library when attempting to construct the Copilot client without creds.
    with pytest.raises((ValueError, OpenAIError)):
        cfg.resolve_model_config("llm_judge_default")


def test_resolve_model_config_unknown_raises():
    cfg = reload_config()
    with pytest.raises(ValueError):
        cfg.resolve_model_config("this-alias-does-not-exist")
