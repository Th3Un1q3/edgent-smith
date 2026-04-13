import json
import os
from dataclasses import dataclass
from typing import Callable
from pydantic_ai.settings import ModelSettings
from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.ollama import OllamaProvider
import httpx
from openai import AsyncOpenAI
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.profiles.openai import OpenAIModelProfile


@dataclass
class ModelConfig:
    alias: str
    model: Model | str
    model_settings: ModelSettings | None = None


def build_ollama_model() -> OpenAIChatModel:
    """Factory that constructs an Ollama-backed OpenAIChatModel on demand.

    This is deliberately a factory so construction happens at resolution time
    (when `resolve_model_config` is called), avoiding network/client setup at
    module import time.
    """
    return OpenAIChatModel(
        model_name=os.getenv("OLLAMA_MODEL_NAME", "gemma4:e2b"),
        provider=OllamaProvider(base_url=os.getenv("OLLAMA_BASE_URL", "http://ollama:11434/v1")),
        profile=OpenAIModelProfile(
            default_structured_output_mode="native",
            supports_json_schema_output=True,
        )
    )


# Copilot (GitHub Copilot) model factory and transport ---------------------------------
# These were previously defined in evals/runner.py — moved here for central configuration.
_COPILOT_BASE_URL = os.getenv("COPILOT_BASE_URL", "https://api.githubcopilot.com")
_COPILOT_DEFAULT_MODEL = os.getenv("COPILOT_DEFAULT_MODEL", "gpt-4o-mini-2024-07-18")


class _CopilotTransport(httpx.AsyncHTTPTransport):
    """Inject the missing ``"object": "chat.completion"`` field.

    The Copilot endpoint omits this field; pydantic-ai requires it when
    parsing OpenAI chat completion responses.
    """

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        response = await super().handle_async_request(request)
        if response.status_code == 200:
            await response.aread()
            try:
                data = json.loads(response.content)
                if isinstance(data, dict) and "choices" in data and "object" not in data:
                    data["object"] = "chat.completion"
                    patched = json.dumps(data).encode()
                    patched_headers = dict(response.headers)
                    for _hdr in ("content-length", "content-encoding", "transfer-encoding"):
                        patched_headers.pop(_hdr, None)
                    response = httpx.Response(
                        status_code=response.status_code,
                        headers=patched_headers,
                        content=patched,
                        request=request,
                    )
            except (json.JSONDecodeError, KeyError):
                pass
        return response


def build_copilot_model(
    model_name: str = _COPILOT_DEFAULT_MODEL,
    http_client: httpx.AsyncClient | None = None,
) -> OpenAIChatModel | None:
    """Return an ``OpenAIChatModel`` backed by the GitHub Copilot API.

    Reads ``GITHUB_COPILOT_API_TOKEN`` from the environment.

    Args:
        model_name: Copilot model identifier.
        http_client: Optional pre-constructed ``httpx.AsyncClient`` with the
            required transport.  When provided the caller is responsible for
            closing it after the run.  When omitted a new client is created
            with :class:`_CopilotTransport` — callers should close it via
            ``asyncio.run(client.aclose())`` when they are done.
    """
    token = os.getenv("GITHUB_COPILOT_API_TOKEN")
    # Be tolerant at import time: return None when the token is not provided
    # so callers can choose a fallback instead of failing module import.
    client = http_client or httpx.AsyncClient(transport=_CopilotTransport())
    openai_client = AsyncOpenAI(
        base_url=_COPILOT_BASE_URL,
        api_key=token,
        http_client=client,
    )
    return OpenAIChatModel(model_name, provider=OpenAIProvider(openai_client=openai_client))


def build_github_model() -> OpenAIChatModel | None:
    """
    GitHub Inference API docs: https://docs.github.com/en/github-models/quickstart
    """
    token = os.getenv("GITHUB_MODEL_API_TOKEN")
    if not token:
        return None
    endpoint = "https://models.github.ai/inference"
    model = "openai/gpt-5-mini"
    return OpenAIChatModel(
        model_name=model,
        provider=OpenAIProvider(
            openai_client=AsyncOpenAI(
                base_url=endpoint,
                api_key=token,
            )
        ),
    )


def _llm_judge_factory() -> Model | str:
    """Factory for the `llm_judge_default` registry entry.

    Try GitHub inference first, then Copilot (if token present).
    Do NOT fall back to Ollama for the judge — require an external model.
    """
    github = build_github_model()
    if github is not None:
        return github
    copilot = build_copilot_model()
    if copilot is not None:
        return copilot
    raise ValueError(
        "llm_judge_default requires a valid GitHub token for inference API or Copilot API. Please set GITHUB_MODEL_API_TOKEN or GITHUB_COPILOT_API_TOKEN in the environment.",
    )


MODEL_FACTORIES: dict[str, Callable[[], Model | str]] = {
    "edge_agent_default": build_ollama_model,
    "edge_agent_fast": build_ollama_model,
    "llm_judge_default": _llm_judge_factory,
}

MODEL_SETTINGS: dict[str, ModelSettings] = {
    "edge_agent_default": ModelSettings(max_tokens=4048),
    "edge_agent_fast": ModelSettings(thinking=False, max_tokens=4048),
    "llm_judge_default": ModelSettings(thinking=True),
}


def resolve_model_config(model_alias: str) -> ModelConfig:
    """Resolve a model alias to a ModelConfig, using factories and settings."""
    if model_alias in MODEL_FACTORIES:
        factory = MODEL_FACTORIES[model_alias]
        model = factory()
        settings = MODEL_SETTINGS.get(model_alias)
        return ModelConfig(alias=model_alias, model=model, model_settings=settings)
    else:
        raise ValueError(f"Unknown model alias: {model_alias}")


__all__ = [
    "ModelConfig",
    "resolve_model_config",
]
