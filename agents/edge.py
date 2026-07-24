"""Edge-optimized agent – construction + execution entry-point with inline tools.

This module provides a single-file, model-agnostic agent runtime for edge deployment.
It defines the structured output schema (``AgentOutput``), wires three inline tools
(calculator, current_datetime, web_search_stub) onto a ``pydantic_ai.Agent``, and
exposes an async entry-point (``run_edge_agent``) that handles tracing bootstrapping,
timeout fallback, tool-usage extraction, timing + output printing.

Model resolution is environment-variable driven by default (``EDGENT_MODEL_ALIAS``),
and provider-specific setup (Ollama, GitHub Copilot, …) belongs in the eval runner, not here.

Usage (programmatic):
    from agents.edge import build_edge_agent, run_edge_agent

Usage (CLI):
    python agents/edge.py "What is 2+2?"
"""

from __future__ import annotations

# isort: skip_file

import ast
import asyncio
import os
import time
from collections.abc import Callable
from datetime import UTC, datetime
import operator
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from agents import edge_tracing
from config import ModelConfig, resolve_model_config
from enum import StrEnum


class ConfidenceEnum(StrEnum):
    """Self-reported confidence level for agent output.

    Values:
        high: The agent is confident in its answer.
        medium: The agent has partial confidence; the answer may need verification.
        low: The agent is uncertain; treat the answer as a best guess.
        abstain: The agent declined to express confidence (default).
    """

    high = "high"
    medium = "medium"
    low = "low"
    abstain = "abstain"


class AgentOutput(BaseModel):
    """Structured output schema for the edge agent's response.

    Fields:
        answer: The agent's direct textual response to the user prompt.
        confidence: Self-reported confidence in the answer (defaults to ``abstain``).
            Use this field downstream to decide whether to surface, verify, or defer the result.
    """

    answer: str = Field(description="The agent's direct response")
    confidence: ConfidenceEnum = Field(
        default=ConfidenceEnum.abstain,
        description="Self-reported confidence: high | medium | low | abstain",
    )


# ── System prompt ──────────────────────────────────────────────────────────────
# A static system prompt injected into every agent run to establish behavioral baseline.
# Enforces concise tool usage and requires citation of external sources, keeping the
# assistant focused on edge-deployment constraints rather than chit-chat.
_SYSTEM = """\
You are a precise, efficient assistant designed for edge deployment on constrained hardware.
- Use tools only when necessary and cite any external sources used.
"""


def build_edge_agent(
    edge_model_config: ModelConfig | None = None,
) -> Agent[Any, AgentOutput]:
    """Construct and return a configured ``pydantic_ai.Agent`` ready for execution.

    This factory wires three inline tools onto the agent, sets structured output to
    ``AgentOutput``, applies the static system prompt (_SYSTEM), and configures retry
    behaviour (3 attempts). Model resolution falls back to environment variables when
    no explicit config is provided.

    Args:
        edge_model_config: Optional model configuration. When omitted, resolves from the
            ``EDGENT_MODEL_ALIAS`` environment variable (defaults to ``edge_agent_default``).

    Returns:
        A configured ``pydantic_ai.Agent`` instance with structured output type
        ``AgentOutput``, inline tools wired, and the static system prompt applied.
    """
    if edge_model_config is None:
        edge_model_config = resolve_model_config(
            os.getenv("EDGENT_MODEL_ALIAS", "edge_agent_default")
        )

    agent = Agent(
        edge_model_config.model,
        output_type=AgentOutput,
        system_prompt=_SYSTEM,
        model_settings=edge_model_config.model_settings,
        defer_model_check=True,
        retries=3,
    )

    agent.tool_plain(current_datetime)
    agent.tool_plain(calculator)
    agent.tool_plain(web_search_stub)
    return agent


async def run_edge_agent(prompt: str | None = None) -> None:
    """Async entry-point: boot tracing, run the edge agent with timeout fallback, print results.

    This function is the primary CLI and programmatic invocation path. It handles the full
    lifecycle — tracing bootstrap, agent construction via ``build_edge_agent()``, execution
    with a 500-second timeout, tool-usage extraction from response messages, and formatted
    output of timing + used tools + structured JSON result.

    Supports dry-run mode (via ``DRY_RUN_LOCAL_LOOP`` environment variable) which simulates
    the agent pipeline without contacting any model provider — useful for offline validation
    of tracing and formatting logic.

    Args:
        prompt: User prompt to pass to the agent. When omitted, falls back to the
            ``PROMPT`` environment variable. Raises ``SystemExit`` if neither source
            provides a value.

    Returns:
        This function prints timing, tool usage, and structured output to stdout; it does not
        return a value. Exits with code 1 when no prompt is available or the agent times out.
    """
    prompt = prompt or os.environ.get("PROMPT", "")
    if not prompt:
        raise SystemExit("PROMPT environment variable is required")

    # Dry-run local loop: when DRY_RUN_LOCAL_LOOP is set, simulate agent run
    # without contacting models.
    result: Any = None
    if os.getenv("DRY_RUN_LOCAL_LOOP"):
        start = time.monotonic()

        # Simulated result matching AgentOutput structure
        class _Sim:
            def __init__(self, output: AgentOutput) -> None:
                self.output: AgentOutput = output

            def all_messages(self) -> list[Any]:
                return []

        simulated_output = AgentOutput(
            answer="dry-run local loop OK",
            confidence=ConfidenceEnum.high,
        )
        result = _Sim(simulated_output)
        elapsed = time.monotonic() - start
    else:
        edge_tracing.bootstrap_local_tracing()
        agent = build_edge_agent()

        TIMEOUT_SECONDS = 500
        invocation_started_at_us = int(time.time() * 1_000_000)
        start = time.monotonic()
        try:
            result = await asyncio.wait_for(agent.run(prompt), timeout=TIMEOUT_SECONDS)
        except TimeoutError as exc:
            msg = f"Edge agent request timed out after {TIMEOUT_SECONDS} seconds"
            raise SystemExit(msg) from exc
        finally:
            elapsed = time.monotonic() - start
            edge_tracing.flush_tracing()
            edge_tracing.print_trace_context()
            print("Trace details:")
            print(
                edge_tracing.fetch_trace_details(invocation_started_at_us=invocation_started_at_us)
            )

    used_tools: list[str] = []
    for message in result.all_messages():
        for part in getattr(message, "parts", []):
            tool_name = getattr(part, "tool_name", None)
            if tool_name:
                used_tools.append(tool_name)

    print(f"Timing: {elapsed:.3f}s")
    print("Tools used:", ", ".join(dict.fromkeys(used_tools)) or "none")
    print(
        "Agent output:",
        result.output.model_dump_json() if isinstance(result.output, BaseModel) else result.output,
    )


# ── Inline tools ───────────────────────────────────────────────────────────────

# Calculator safety limits
_MAX_EXPR_LEN = 200
_MAX_EXPONENT = 100

# Allowlist of binary and unary operators for the AST evaluator.
_BINOPS: dict[type, Callable[[int | float, int | float], int | float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
    ast.Mod: operator.mod,
    ast.FloorDiv: operator.floordiv,
}
_UNOPS: dict[type, Callable[[int | float], int | float]] = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def _eval_ast(node: ast.expr) -> int | float:
    """Recursively evaluate a safe arithmetic AST node produced by ``ast.parse()``.

    This is the core safety gate for the calculator tool. It walks an expression AST and
    only permits operators from whitelisted sets (_BINOPS, _UNOPS). Exponentiation magnitude
    is capped at ``_MAX_EXPONENT``, and any non-constant, unlisted operator, or out-of-range
    operand raises ``ValueError`` — preventing arbitrary code execution.

    Type-propagation follows Python's rules: purely integer operands yield ``int``, while any
    float operand or float-producing operator (e.g., truediv) yields ``float``.

    Args:
        node: An AST expression node to evaluate. Must be a Constant, BinOp, or UnaryOp from
            the permitted operator sets; other types raise ``ValueError``.

    Returns:
        The computed numeric result as ``int`` or ``float``, following Python's type-propagation
        rules for arithmetic operations.

    Raises:
        ValueError: When the node represents an unsupported expression type, a non-numeric
            constant, an unlisted operator, or when exponentiation magnitude exceeds the cap.
    """
    if isinstance(node, ast.Constant):
        if not isinstance(node.value, (int, float)):
            raise ValueError("non-numeric constant")
        return node.value
    if isinstance(node, ast.BinOp):
        bin_op = type(node.op)
        if bin_op not in _BINOPS:
            raise ValueError(f"unsupported operator: {bin_op.__name__}")
        left = _eval_ast(node.left)
        right = _eval_ast(node.right)
        if bin_op is ast.Pow and abs(float(right)) > _MAX_EXPONENT:
            raise ValueError(f"exponent {right} exceeds maximum {_MAX_EXPONENT}")
        return _BINOPS[bin_op](left, right)
    if isinstance(node, ast.UnaryOp):
        un_op = type(node.op)
        if un_op not in _UNOPS:
            raise ValueError(f"unsupported unary operator: {un_op.__name__}")
        return _UNOPS[un_op](_eval_ast(node.operand))
    raise ValueError(f"unsupported expression type: {type(node).__name__}")


def current_datetime() -> str:
    """Return the current UTC date and time as an ISO 8601 string.

    Provides a deterministic, timezone-aware timestamp for agent tool calls that need temporal
    context without depending on external APIs or user-provided values.

    Returns:
        An ISO 8601 formatted string (e.g., ``"2026-06-29T14:30:00+00:00"``) representing the
        current moment in UTC. Includes timezone offset for unambiguous parsing downstream.
    """
    return datetime.now(tz=UTC).isoformat()


def calculator(expression: str) -> str:
    """Evaluate a simple arithmetic expression safely via ``_eval_ast()``.

    Parses the input string into an AST, runs it through the safety-gated evaluator, and
    returns the result as a string. Catches all error conditions (syntax, value errors,
    division by zero, overflow) and wraps them in a descriptive error message.

    Args:
        expression: A mathematical expression string supporting ``+``, ``-``, ``*``,
            ``/``, ``//`` (floor-div), ``%`` (mod), ``**`` (power), parentheses, digits,
            and decimals. Must not exceed the maximum length limit (_MAX_EXPR_LEN).

    Returns:
        The computed result as a string, or an error message prefixed with ``"Error:"`` if
        the expression is invalid, unsafe, or exceeds limits.
    """
    if len(expression) > _MAX_EXPR_LEN:
        return f"Error: expression too long (max {_MAX_EXPR_LEN} characters)"
    try:
        tree = ast.parse(expression, mode="eval")
        result = _eval_ast(tree.body)
        return str(result)
    except (SyntaxError, ValueError) as exc:
        return f"Error: {exc}"
    except ZeroDivisionError:
        return "Error: division by zero"
    except OverflowError:
        return "Error: result too large"


def web_search_stub(query: str) -> str:
    """Placeholder inline tool reporting no search backend is configured.

    This stub exists so the agent graph remains complete in offline or edge environments
    where no external search provider is available. In production deployments, replace its body
    with a call to an actual search API (e.g., web_search, tavily, duckduckgo). The return
    format below is intentionally human-readable so that downstream consumers can distinguish
    stub responses from real results.

    Args:
        query: The user's search term forwarded by the agent when it invokes this tool.

    Returns:
        A descriptive string indicating that no external search backend is configured, along
        with the original query for traceability. Replace in production with actual search output.
    """
    return (
        f"[web_search_stub] query='{query}' – "
        "no external search backend is configured in this deployment. "
        "Answer from context only."
    )


if __name__ == "__main__":
    asyncio.run(run_edge_agent())
