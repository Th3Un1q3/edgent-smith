"""Edge-optimized PydanticAI agent with bounded context and tool discipline."""

from __future__ import annotations

import structlog
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext

from edgent_smith.config.settings import Settings, get_settings
from edgent_smith.providers import get_provider
from edgent_smith.tools import get_default_tools

logger = structlog.get_logger(__name__)


class AgentDeps(BaseModel):
    """Dependencies injected into the agent at runtime."""

    run_id: str
    max_tokens: int = 512
    max_tool_calls: int = 5


class AgentResult(BaseModel):
    """Structured result returned by the edge agent."""

    answer: str = Field(description="The agent's answer or output")
    tool_calls_used: int = Field(default=0, description="Number of tool calls made")
    tokens_used: int | None = Field(default=None, description="Approximate tokens consumed")
    confidence: str = Field(
        default="medium",
        description="Self-reported confidence: high | medium | low | abstain",
    )


SYSTEM_PROMPT = """\
You are a precise, efficient assistant designed for edge deployment.
Rules:
- Keep responses concise and factual. Avoid verbosity.
- Use tools only when necessary. Prefer reasoning from context first.
- If uncertain or the task is outside your knowledge, say so clearly (confidence: abstain).
- Never fabricate facts. Accuracy over completeness.
- Respect the token budget: prefer shorter, correct answers over long ones.
"""


class EdgeAgent:
    """Wraps the PydanticAI agent with edge-model-specific configuration."""

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()
        self._provider = get_provider(self._settings)
        self._agent = self._build_agent()

    def _build_agent(self) -> Agent[AgentDeps, AgentResult]:
        model = self._provider.get_pydantic_ai_model()
        tools = get_default_tools()
        return Agent(
            model,
            deps_type=AgentDeps,
            result_type=AgentResult,
            system_prompt=SYSTEM_PROMPT,
            tools=tools,
        )

    async def run(self, prompt: str, deps: AgentDeps) -> AgentResult:
        """Execute the agent with the given prompt and dependencies."""
        logger.info("agent.run.start", run_id=deps.run_id, prompt_len=len(prompt))
        result = await self._agent.run(prompt, deps=deps)
        logger.info(
            "agent.run.complete",
            run_id=deps.run_id,
            confidence=result.data.confidence,
        )
        return result.data


def build_edge_agent(settings: Settings | None = None) -> EdgeAgent:
    """Factory function for EdgeAgent."""
    return EdgeAgent(settings)
