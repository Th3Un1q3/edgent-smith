#!/usr/bin/env python3
"""Extract session parts from OpenCode session export JSON files.

Flows
-----
conversation
    Emit one line per text/tool part, in session message order. Reasoning,
    step-start, step-finish and other non-text/tool parts are omitted.
parts
    Print human-readable blocks for parts, tool calls and messages matched by
    ``--part-id`` / ``--tool-id`` / ``--message-id`` (part, then tool, then
    message block order).
info
    Emit session-level info (identity, model, timings, tokens, cost) from
    ``.info`` as ``key=value`` (default), ``json`` or ``markdown``.
summary
    Emit review.md §3-§7 aggregations over ``messages`` (skills loaded,
    steering instructions, tool calls, consolidated errors, token distribution)
    as ``markdown`` (default) or ``json``.

All parsing is defensive: fields are read with ``.get()`` and may be missing
or ``None`` without crashing.

Examples
--------
    uv run session_parts.py --session-file-json session.json \\
        conversation --format short-human-readable
    uv run session_parts.py --session-file-json session.json parts \\
        --tool-id call_00_... --message-id msg_... --part-id prt_...
    uv run session_parts.py --session-file-json session.json info
    uv run session_parts.py --session-file-json session.json summary --format markdown
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

import click


def truncate(s):
    """Truncate *s* to 200 chars, keeping head and tail around a middle '...' (None-safe)."""
    if s is None:
        return ""
    if len(s) <= 200:
        return s
    return s[:99] + "..." + s[-98:]


def compact_json(obj):
    """Render *obj* compactly with sorted keys (single-line, no spaces)."""
    return json.dumps(obj, separators=(",", ":"), sort_keys=True)


def tool_state(part):
    """Extract (state, status, output) from a tool part (None-safe)."""
    state = part.get("state") or {}
    return state, state.get("status"), state.get("output") or ""


def load_session(path):
    """Load the session export and return its top-level object (exit 1 on failure).

    A top-level JSON value that is not an object is treated as an empty session.
    The file check lives here, not in click, so a missing/invalid file exits
    with code 1 rather than 2.
    """
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        click.echo(f"error: session file not found: {path}", err=True)
        sys.exit(1)
    except json.JSONDecodeError as exc:
        click.echo(f"error: invalid session JSON in {path}: {exc}", err=True)
        sys.exit(1)
    return data if isinstance(data, dict) else {}


def load_messages(path):
    """Load the session export and return its ``messages`` list (exit 1 on failure)."""
    messages = load_session(path).get("messages")
    return messages if isinstance(messages, list) else []


def conversation_lines(messages):
    """Build the logical `conversation` output lines for the session."""
    lines = []
    for message in messages:
        info = message.get("info") or {}
        role = info.get("role", "")
        for part in message.get("parts") or []:
            mid = part.get("messageID", "")
            ptype = part.get("type")
            if ptype == "text":
                lines.append(f"{mid} [{role}]: {truncate(part.get('text'))}")
            elif ptype == "tool":
                state, status, output = tool_state(part)
                head = (
                    f"{mid} [{role}] tool {part.get('tool', '')} "
                    f"called {part.get('callID', '')}"
                )
                if status == "completed":
                    lines.append(
                        f'{head}, output_length={len(output)}, '
                        f'input: "{truncate(compact_json(state.get("input")))}", '
                        f'output: "{truncate(output)}"'
                    )
                elif status == "error":
                    lines.append(f'{head}, error: "{truncate(state.get("error"))}"')
                else:
                    lines.append(head)
    return lines


def part_block(part):
    """Build the `parts` block for one matched part (by ``--part-id``)."""
    mid = part.get("messageID", "")
    ptype = part.get("type")
    if ptype in ("text", "reasoning"):
        return (
            f"part {part.get('id', '')} ({ptype}, message {mid}):\n"
            f"  text: {part.get('text', '')}"
        )
    if ptype == "tool":
        state, status, output = tool_state(part)
        lines = [
            f"part {part.get('id', '')} (tool {part.get('tool', '')}, "
            f"message {mid}, status={status}):"
        ]
        if "input" in state:
            lines.append(f"  input: {truncate(compact_json(state['input']))}")
        if status == "completed":
            lines.append(f"  output: {truncate(output)}")
            lines.append(f"  output_length: {len(output)}")
        elif status == "error":
            lines.append(f"  error: {truncate(state.get('error'))}")
        return "\n".join(lines)
    return f"part {part.get('id', '')} ({ptype}, message {mid}):"


def tool_block(part):
    """Build the `parts` block for one matched tool part (by ``--tool-id``)."""
    state, status, output = tool_state(part)
    lines = [
        f"tool {part.get('tool', '')} called {part.get('callID', '')} "
        f"(message {part.get('messageID', '')}, status={status}):"
    ]
    if "input" in state:
        lines.append(f"  input: {truncate(compact_json(state['input']))}")
    if status == "completed":
        lines.append(f"  output: {truncate(output)}")
        lines.append(f"  output_length: {len(output)}")
    elif status == "error":
        lines.append(f"  error: {truncate(state.get('error'))}")
    return "\n".join(lines)


def message_block(message):
    """Build the `parts` block for one matched message (by ``--message-id``)."""
    info = message.get("info") or {}
    lines = [f"message {info.get('id', '')} (role={info.get('role', '')}):"]
    for part in message.get("parts") or []:
        ptype = part.get("type")
        if ptype == "text":
            lines.append(f"  text: {part.get('text', '')}")
        elif ptype == "tool":
            lines.append(
                f"  tool {part.get('tool', '')} called {part.get('callID', '')}"
            )
        else:
            lines.append(f"  {ptype or ''}")
    return "\n".join(lines)


# --- info / summary helpers ---


def _unknown(value):
    """Render a missing value as the literal string `unknown` (None-safe)."""
    return value if value is not None else "unknown"


def human_duration(ms):
    """Render a millisecond delta as `Xh Ym Zs` / `Ym Zs` / `Zs` (None-safe)."""
    if not isinstance(ms, (int, float)):
        return "unknown"
    total_s = int(ms // 1000)
    h, rem = divmod(total_s, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}h {m}m {s}s"
    if m:
        return f"{m}m {s}s"
    return f"{s}s"


def token_total(tokens):
    """Total tokens: the stored `total` if present, else input+output+reasoning+cache.read.

    Requires input/output/reasoning to be numeric; otherwise `unknown`.
    """
    if not isinstance(tokens, dict):
        return "unknown"
    if isinstance(tokens.get("total"), (int, float)):
        return tokens["total"]
    cache = tokens.get("cache") or {}
    parts = [tokens.get(k) for k in ("input", "output", "reasoning")]
    if not all(isinstance(v, (int, float)) for v in parts):
        return "unknown"
    total = sum(parts)
    cache_read = cache.get("read")
    if isinstance(cache_read, (int, float)):
        total += cache_read
    return total


def info_values(info):
    """Ordered (label, value) pairs for session-level info; missing -> None (rendered unknown)."""
    info = info or {}
    model = info.get("model") or {}
    tokens = info.get("tokens") or {}
    cache = tokens.get("cache") or {}
    time = info.get("time") or {}
    created, updated = time.get("created"), time.get("updated")
    duration = (
        human_duration(updated - created)
        if isinstance(created, (int, float)) and isinstance(updated, (int, float))
        else "unknown"
    )
    return [
        ("id", info.get("id")),
        ("slug", info.get("slug")),
        ("title", info.get("title")),
        ("agent", info.get("agent")),
        ("model.id", model.get("id")),
        ("model.providerID", model.get("providerID")),
        ("created", created),
        ("updated", updated),
        ("duration", duration),
        ("tokens.input", tokens.get("input")),
        ("tokens.output", tokens.get("output")),
        ("tokens.reasoning", tokens.get("reasoning")),
        ("tokens.cache.read", cache.get("read")),
        ("tokens.cache.write", cache.get("write")),
        ("tokens.total", token_total(tokens)),
        ("cost", info.get("cost")),
    ]


def info_json(info):
    """Session-level info as a nested dict for `--format json` (missing -> `unknown`)."""
    info = info or {}
    model = info.get("model") or {}
    tokens = info.get("tokens") or {}
    cache = tokens.get("cache") or {}
    time = info.get("time") or {}
    created, updated = time.get("created"), time.get("updated")
    duration = (
        human_duration(updated - created)
        if isinstance(created, (int, float)) and isinstance(updated, (int, float))
        else "unknown"
    )
    return {
        "id": _unknown(info.get("id")),
        "slug": _unknown(info.get("slug")),
        "title": _unknown(info.get("title")),
        "agent": _unknown(info.get("agent")),
        "model": {
            "id": _unknown(model.get("id")),
            "providerID": _unknown(model.get("providerID")),
        },
        "created": _unknown(created),
        "updated": _unknown(updated),
        "duration": duration,
        "tokens": {
            "input": _unknown(tokens.get("input")),
            "output": _unknown(tokens.get("output")),
            "reasoning": _unknown(tokens.get("reasoning")),
            "cache": {
                "read": _unknown(cache.get("read")),
                "write": _unknown(cache.get("write")),
            },
            "total": token_total(tokens),
        },
        "cost": _unknown(info.get("cost")),
    }


TASK_SKILLS_RE = re.compile(r"<task_skills>(.*?)</task_skills>", re.DOTALL)
SKILL_TAG_RE = re.compile(r'<skill\s+name="([^"]+)"\s+path="([^"]*)"')


def skill_loads(messages):
    """Skills loaded per the plan §9 definition (deduped by name).

    Signal (a): a native `skill` tool call. Signal (b): a `<skill>` tag INSIDE a
    `<task_skills>` payload in a user text part (the delegated envelope form).
    Bare prose `<skill ... location=.../>` tags are never scanned, because the
    regex is scoped to `<task_skills>` payloads only.
    """
    loads = []
    seen = set()
    for message in messages:
        role = (message.get("info") or {}).get("role")
        for part in message.get("parts") or []:
            if part.get("type") == "tool" and part.get("tool") == "skill":
                state = part.get("state") or {}
                name = (state.get("input") or {}).get("name")
                if name and name not in seen:
                    seen.add(name)
                    loads.append(
                        {
                            "name": name,
                            "source": "tool",
                            "dir": (state.get("input") or {}).get("dir")
                            or (state.get("metadata") or {}).get("dir"),
                            "truncated": (state.get("metadata") or {}).get("truncated"),
                        }
                    )
            elif part.get("type") == "text" and role == "user":
                for payload in TASK_SKILLS_RE.findall(part.get("text") or ""):
                    for name, path in SKILL_TAG_RE.findall(payload):
                        if name not in seen:
                            seen.add(name)
                            loads.append(
                                {"name": name, "source": "delegated", "dir": path}
                            )
    return loads


def steering_rows(messages):
    """Steering instructions: text parts starting with `<steering`."""
    rows = []
    for message in messages:
        for part in message.get("parts") or []:
            if part.get("type") != "text":
                continue
            text = part.get("text") or ""
            if not text.startswith("<steering"):
                continue
            priority = re.search(r'priority="([^"]*)"', text)
            reason = re.search(r'reason="([^"]*)"', text)
            rows.append(
                {
                    "severity": priority.group(1) if priority else "unknown",
                    "reason": reason.group(1) if reason else "unknown",
                }
            )
    return rows


def tool_counts(messages):
    """Per-tool call counts with success (completed) / error split."""
    counts = {}
    for message in messages:
        for part in message.get("parts") or []:
            if part.get("type") != "tool":
                continue
            tool = part.get("tool") or "unknown"
            entry = counts.setdefault(tool, {"count": 0, "success": 0, "errors": 0})
            entry["count"] += 1
            status = (part.get("state") or {}).get("status")
            if status == "completed":
                entry["success"] += 1
            elif status == "error":
                entry["errors"] += 1
    return counts


def error_rows(messages):
    """Consolidated errors: tool errors + step-finish failures + reasoning mentions."""
    rows = []
    for message in messages:
        for part in message.get("parts") or []:
            state = part.get("state") or {}
            ptype = part.get("type")
            if ptype == "tool" and state.get("status") == "error":
                rows.append(
                    {
                        "source": f"tool {part.get('tool', '')}",
                        "callID": part.get("callID", ""),
                        "description": state.get("error")
                        or state.get("output")
                        or "unknown",
                    }
                )
            elif ptype == "step-finish" and (
                state.get("status") == "error" or state.get("error")
            ):
                rows.append(
                    {
                        "source": "step-finish",
                        "callID": part.get("id", ""),
                        "description": state.get("error") or "unknown",
                    }
                )
            elif ptype == "reasoning" and re.search(
                r"error|fail", part.get("text") or "", re.IGNORECASE
            ):
                rows.append(
                    {
                        "source": "reasoning",
                        "callID": part.get("id", ""),
                        "description": truncate(part.get("text") or ""),
                    }
                )
    return rows


def summary_markdown(data, messages):
    """Markdown sections shaped for review.md §3/§4/§5/§6/§7."""
    info = data.get("info") or {}
    tokens = info.get("tokens") or {}
    cache = tokens.get("cache") or {}
    sections = []

    skills = skill_loads(messages)
    lines = [
        "## 3. Skills Loaded",
        "| Skill Name | Directory | Truncated? |",
        "|------------|-----------|------------|",
    ]
    for s in skills:
        truncated = s.get("truncated")
        if truncated is None:
            truncated = "—"
        else:
            truncated = "yes" if truncated else "no"
        lines.append(f"| {s['name']} | {s.get('dir') or '—'} | {truncated} |")
    if not skills:
        lines.append("*No skills loaded.*")
    sections.append("\n".join(lines))

    steering = steering_rows(messages)
    lines = [
        "## 4. Steering Instructions",
        "| # | Reason | Severity |",
        "|---|--------|----------|",
    ]
    for i, s in enumerate(steering, 1):
        lines.append(f"| {i} | {s['reason']} | {s['severity']} |")
    if not steering:
        lines.append("*No steering instructions detected.*")
    sections.append("\n".join(lines))

    counts = tool_counts(messages)
    lines = [
        "## 5. Tool Calls",
        "| Tool Name | Call Count | Success | Errors |",
        "|-----------|-----------|---------|--------|",
    ]
    for tool in sorted(counts):
        c = counts[tool]
        lines.append(f"| {tool} | {c['count']} | {c['success']} | {c['errors']} |")
    if not counts:
        lines.append("*No tool calls recorded.*")
    sections.append("\n".join(lines))

    errors = error_rows(messages)
    lines = ["## 6. Consolidated Errors"]
    for e in errors:
        ref = f" ({e['callID']})" if e.get("callID") else ""
        lines.append(f"- **{e['source']}**{ref}: {e['description']}")
    if not errors:
        lines.append("*No errors recorded.*")
    sections.append("\n".join(lines))

    total = token_total(tokens)
    lines = [
        "## 7. Token Distribution",
        "| Category | Tokens |",
        "|----------|--------|",
        f"| Input | {_unknown(tokens.get('input'))} |",
        f"| Output | {_unknown(tokens.get('output'))} |",
        f"| Reasoning | {_unknown(tokens.get('reasoning'))} |",
        f"| Cache Read | {_unknown(cache.get('read'))} |",
        f"| Cache Write | {_unknown(cache.get('write'))} |",
        f"| **Total** | {total} |",
        f"| **Cost:** | {_unknown(info.get('cost'))} |",
    ]
    sections.append("\n".join(lines))

    return "\n\n".join(sections)


def summary_json(data, messages):
    """Structured aggregations for `--format json`."""
    info = data.get("info") or {}
    tokens = info.get("tokens") or {}
    cache = tokens.get("cache") or {}
    return {
        "skills": skill_loads(messages),
        "steering": steering_rows(messages),
        "tools": tool_counts(messages),
        "errors": error_rows(messages),
        "tokens": {
            "input": _unknown(tokens.get("input")),
            "output": _unknown(tokens.get("output")),
            "reasoning": _unknown(tokens.get("reasoning")),
            "cache": {
                "read": _unknown(cache.get("read")),
                "write": _unknown(cache.get("write")),
            },
            "total": token_total(tokens),
        },
        "cost": _unknown(info.get("cost")),
    }


@click.group()
@click.option(
    "--session-file-json",
    required=True,
    type=click.Path(dir_okay=False, path_type=pathlib.Path),
)
@click.pass_context
def cli(ctx, session_file_json):
    """Extract session parts from OpenCode session export JSON files."""
    ctx.obj = session_file_json


@cli.command()
@click.option(
    "--format",
    "fmt",
    default="short-human-readable",
    type=click.Choice(["short-human-readable"]),
)
@click.pass_obj
def conversation(session_file_json, fmt):
    """Emit one line per text/tool part in message order."""
    lines = conversation_lines(load_messages(session_file_json))
    if lines:
        click.echo("\n".join(lines))


@cli.command()
@click.option("--message-id", "message_ids", multiple=True, type=str)
@click.option("--tool-id", "tool_ids", multiple=True, type=str)
@click.option("--part-id", "part_ids", multiple=True, type=str)
@click.pass_obj
def parts(session_file_json, message_ids, tool_ids, part_ids):
    """Print blocks for matched parts, tool calls and messages."""
    messages = load_messages(session_file_json)
    part_ids, tool_ids, message_ids = set(part_ids), set(tool_ids), set(message_ids)

    blocks = []
    emitted = set()  # id() of tool parts already emitted as PART blocks

    for message in messages:
        for part in message.get("parts") or []:
            if part.get("id") in part_ids:
                blocks.append(part_block(part))
                if part.get("type") == "tool":
                    emitted.add(id(part))

    for message in messages:
        for part in message.get("parts") or []:
            if (
                part.get("type") == "tool"
                and part.get("callID") in tool_ids
                and id(part) not in emitted
            ):
                blocks.append(tool_block(part))

    for message in messages:
        info = message.get("info") or {}
        if info.get("id") in message_ids:
            blocks.append(message_block(message))

    if blocks:
        click.echo("\n\n".join(blocks))


@cli.command()
@click.option(
    "--format",
    "fmt",
    default="key=value",
    type=click.Choice(["json", "key=value", "markdown"]),
)
@click.pass_obj
def info(session_file_json, fmt):
    """Emit session-level info: identity, model, timings, tokens, cost."""
    data = load_session(session_file_json)
    if fmt == "json":
        click.echo(compact_json(info_json(data.get("info"))))
    elif fmt == "markdown":
        pairs = info_values(data.get("info"))
        rows = ["| Field | Value |", "|-------|-------|"]
        rows += [f"| {label} | {_unknown(value)} |" for label, value in pairs]
        click.echo("\n".join(rows))
    else:
        click.echo(
            "\n".join(
                f"{label}={_unknown(value)}" for label, value in info_values(data.get("info"))
            )
        )


@cli.command()
@click.option(
    "--format",
    "fmt",
    default="markdown",
    type=click.Choice(["json", "markdown"]),
)
@click.pass_obj
def summary(session_file_json, fmt):
    """Emit review.md §3-§7 aggregations: skills, steering, tools, errors, tokens."""
    data = load_session(session_file_json)
    messages = data.get("messages") or []
    if fmt == "json":
        click.echo(compact_json(summary_json(data, messages)))
    else:
        click.echo(summary_markdown(data, messages))


if __name__ == "__main__":
    cli()
