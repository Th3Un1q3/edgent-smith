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

All parsing is defensive: fields are read with ``.get()`` and may be missing
or ``None`` without crashing.

Examples
--------
    uv run session_parts.py --session-file-json session.json \\
        conversation --format short-human-readable
    uv run session_parts.py --session-file-json session.json parts \\
        --tool-id call_00_... --message-id msg_... --part-id prt_...
"""

from __future__ import annotations

import json
import pathlib
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


def load_messages(path):
    """Load the session export and return its ``messages`` list (exit 1 on failure).

    A top-level JSON value that is not an object with a ``messages`` list is
    treated as having no messages. The file check lives here, not in click, so
    a missing/invalid file exits with code 1 rather than 2.
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
    if not (isinstance(data, dict) and isinstance(data.get("messages"), list)):
        return []
    return data["messages"]


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


if __name__ == "__main__":
    cli()
