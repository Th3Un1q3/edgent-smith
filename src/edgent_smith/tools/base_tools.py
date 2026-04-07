"""Built-in tools for the edge agent.

Design principles:
- Each tool is a pure async function with clear input/output types.
- Tools are deterministic or have bounded side effects.
- No tool should make network calls in production without explicit config.
"""

from __future__ import annotations

import math
import re
from datetime import UTC, datetime

import structlog
from pydantic import BaseModel
from pydantic_ai import RunContext

from edgent_smith.agents.base_deps import AgentDepsProtocol

logger = structlog.get_logger(__name__)


class CalcInput(BaseModel):
    expression: str


class SearchInput(BaseModel):
    query: str


async def current_datetime_tool(ctx: RunContext[AgentDepsProtocol]) -> str:
    """Return the current UTC datetime as an ISO 8601 string."""
    now = datetime.now(tz=UTC).isoformat()
    logger.debug("tool.current_datetime", run_id=ctx.deps.run_id, result=now)
    return now


_MATH_SAFE_NS: dict[str, object] = {
    name: getattr(math, name)
    for name in (
        "sqrt", "cbrt", "exp", "log", "log2", "log10",
        "sin", "cos", "tan", "asin", "acos", "atan", "atan2",
        "degrees", "radians", "hypot",
        "floor", "ceil", "trunc", "fabs", "factorial",
        "pow", "pi", "e", "tau", "inf", "nan",
    )
    if hasattr(math, name)
}

# Matches digits, whitespace, arithmetic operators (+−*/), power (**),
# parentheses, and decimal points. The ** power operator is two consecutive
# asterisks, both of which are individually permitted by this pattern.
_SAFE_EXPR_RE = re.compile(r"[\d\s\+\-\*\/\.\(\)]+$")


async def calculator_tool(ctx: RunContext[AgentDepsProtocol], expression: str) -> str:
    """Evaluate a simple arithmetic expression and return the result.

    Supports: +, -, *, /, ** (power), (, ), digits, and decimal points.
    Returns an error string if the expression is invalid.
    """
    if not _SAFE_EXPR_RE.match(expression):
        return "Error: invalid characters in expression"
    try:
        result = eval(expression, {"__builtins__": {}}, _MATH_SAFE_NS)  # noqa: S307
        logger.debug("tool.calculator", run_id=ctx.deps.run_id, expr=expression, result=result)
        return str(result)
    except Exception as exc:
        return f"Error: {exc}"


async def web_search_stub_tool(ctx: RunContext[AgentDepsProtocol], query: str) -> str:
    """Stub web search tool – returns a placeholder in offline/edge environments.

    Replace with a real search backend by implementing a SearchProvider and
    wiring it through settings.
    """
    logger.warning("tool.web_search_stub.called", run_id=ctx.deps.run_id, query=query)
    return (
        f"[web_search_stub] Query received: '{query}'. "
        "No external search backend is configured in this deployment. "
        "Answer from context only."
    )
