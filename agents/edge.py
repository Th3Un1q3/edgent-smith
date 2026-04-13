"""Edge-optimized agent – single-file implementation with inline tools.

All tools are defined inline.  The agent is model-agnostic: the default model
is a string resolved from environment variables and may be overridden at
call-time via ``agent.run(prompt, model=...)``.  Provider-specific setup
(Ollama, GitHub Copilot, …) belongs in the eval runner, not here.

Usage (programmatic):
    from agents.edge import agent, run_agent

Usage (CLI):
    python agents/edge.py "What is 2+2?"
"""

from __future__ import annotations

# isort: skip_file

import ast
from collections.abc import Callable
from datetime import UTC, datetime
import operator
import os
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from config import ModelConfig, resolve_model_config


class AgentOutput(BaseModel):
    """Structured output returned by the edge agent."""

    answer: str = Field(description="The agent's direct response")
    confidence: str = Field(
        default="medium",
        description="Self-reported confidence: high | medium | low | abstain",
    )


# ── System prompt ──────────────────────────────────────────────────────────────
_SYSTEM = """\
You are a precise, efficient assistant designed for edge deployment on constrained hardware.
- Use tools only when necessary and cite any external sources used.
- If uncertain or the task is outside your knowledge, say so (confidence: abstain).
"""


def build_edge_agent(
    edge_model_config: ModelConfig | None = None,
) -> Agent[Any, AgentOutput]:
    """Construct and return a configured `pydantic_ai.Agent`.

    Args:
        edge_model_config: Optional model config to use for the agent. If not provided, the config will be resolved from environment variables.
    """
    if edge_model_config is None:
        edge_model_config = resolve_model_config("edge_agent_default")

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
    """Recursively evaluate a safe arithmetic AST node.

    Returns ``int`` for purely-integer operations and ``float`` when any
    operand or the operator itself (e.g. truediv) produces a float — mirroring
    Python's own type-propagation rules.
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
    """Return the current UTC date and time as an ISO 8601 string."""
    return datetime.now(tz=UTC).isoformat()


def calculator(expression: str) -> str:
    """Evaluate a simple arithmetic expression.

    Supports: +, -, *, /, // (floor-div), % (mod), ** (power), (, ), digits, decimals.
    Returns an error message if the expression is invalid, unsafe, or too large.
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
    """Stub web-search tool for offline/edge environments.

    Replace the body with a real search backend when one is available.
    """
    return (
        f"[web_search_stub] query='{query}' – "
        "no external search backend is configured in this deployment. "
        "Answer from context only."
    )
