"""Typed settings for edgent-smith, loaded from environment variables."""

from __future__ import annotations

from enum import Enum
from typing import Annotated

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"


class ModelProvider(str, Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="EDGENT_",
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Application
    app_name: str = "edgent-smith"
    app_version: str = "0.1.0"
    debug: bool = False
    log_level: LogLevel = LogLevel.INFO
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 1

    # Model provider
    model_provider: ModelProvider = ModelProvider.OLLAMA
    model_name: str = "gemma3:4b"

    # Ollama
    ollama_base_url: str = "http://localhost:11434"

    # Edge-model constraints
    max_tokens: Annotated[int, Field(ge=64, le=8192)] = 512
    max_retries: Annotated[int, Field(ge=0, le=10)] = 3
    timeout_seconds: Annotated[float, Field(ge=1.0, le=120.0)] = 30.0
    max_tool_calls: Annotated[int, Field(ge=1, le=20)] = 5

    # Job execution
    job_queue_size: Annotated[int, Field(ge=1, le=1000)] = 100
    job_ttl_seconds: int = 3600

    # Eval
    eval_baseline_path: str = "experiments/baselines/current.json"
    eval_results_dir: str = "experiments/results"


_settings: Settings | None = None


def get_settings() -> Settings:
    """Return the singleton settings instance."""
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
