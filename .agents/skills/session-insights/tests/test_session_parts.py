"""Tests for the `session_parts.py` CLI (new Click interface: `conversation` / `parts` flows).

TDD status: the script at `scripts/session_parts.py` is STILL the old argparse
implementation (`format`/`extract`). These tests target the NEW Click interface
(`--session-file-json <path> conversation|parts ...`) and are therefore RED until
the script is rewritten.

Fixture provenance
------------------
Source session: `/workspace/.tmp/session-review/ses_031f2b634ffep3ESmVmc0nPA3b/session.json`
(real OpenCode session export, 96 KB, title "Explore repo devcontainer setup
(@rug-swe subagent)", agent `rug-swe`, 7 messages).

The fixture at `tests/fixtures/session.json` was TRIMMED from the real export:
- Kept real messages [1, 3, 5] verbatim (assistant / user / assistant) -> 3 messages.
- Dropped real messages [0, 2, 4, 6].
- Truncated the `state.output` string of the 4 `completed` tool parts to a 400-char
  real prefix (still > 200 chars, so the truncate-to-200 behaviour stays exercised).
All field names and object structure are verbatim from the real export; no schema
was hand-crafted. Trimming was done by a script, not by hand.

Fixture content summary (3 messages, in order):
  M0 assistant msg_fce0d4a10001bR02RIHWfI4UI5
     step-start / reasoning(557) / text(129) /
     tool bash call_00_Q6XqhuCnezeau9NGGzZB8961 completed (input 139, output 400) /
     tool read call_01_ND0sKaHnuFQn26SK6cwG5320 completed (input 57, output 400) / step-finish
  M1 user     msg_fce0d69a00016uMS9p3x14kqSS
     text(277)
  M2 assistant msg_fce14a270001IYpdKJYI7Y8jK8
     step-start / reasoning(2219) / text(211) /
     tool bash call_00_sd5HRDsI5lCcvz949INd8202 error (input 386, error 60) /
     tool read call_01_p63r4FRVsM8GP0d8d0co1609 completed (input 34, output 400) /
     tool bash call_02_TCN7th9aqVm8acjJGkKX9114 completed (input 483, output 400) / step-finish

Expected `conversation` output: 3 text lines + 5 tool lines = 8 logical lines
(reasoning, step-start, step-finish omitted). NOTE: truncated excerpts keep their
interior newlines, so a logical line may span several physical lines in stdout.

Contract interpretation (unchanged from the old suite): `msg_<messageID>` in the
output templates means the message id taken from part["messageID"] as-is (it already
starts with "msg_"), e.g. `msg_fce0d4a10001bR02RIHWfI4UI5 [assistant]: ...`.

Test strategy
-------------
All tests invoke the script EXACTLY as documented, via subprocess:
`uv run --quiet {SCRIPT} --session-file-json <path> <subcommand> ...`.
`uv` resolves `click` from the project environment (`click>=8.1,<10` is a dependency
in /workspace/pyproject.toml; verified: click 8.3.2 is importable under
`uv run --quiet python -c "import click"`). Subprocess-only keeps the suite
independent of the future module's internal structure (e.g. the Click group object
name), exercises the user-documented invocation for every assertion, and produces
uniform RED failures against the old argparse script. `uv run --quiet` works in this
environment; if it ever prints extra output, drop `--quiet` (stderr equality
assertions below would then need loosening).
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

import pytest

SCRIPT = Path(__file__).parent.parent / "scripts" / "session_parts.py"
FIXTURE = Path(__file__).parent / "fixtures" / "session.json"

# --- spec-mirroring helpers (computed from the fixture content, not the script) ---


def truncate(s: str | None, n: int = 200) -> str:
    """Mirror of the contract: middle-truncate to n chars (head + '...' + tail)."""
    if s is None:
        return ""
    if len(s) <= n:
        return s
    return s[:99] + "..." + s[-98:]


def compact_json(obj: object) -> str:
    """Mirror of the contract: json.dumps with separators (',', ':') and sort_keys."""
    return json.dumps(obj, separators=(",", ":"), sort_keys=True)


def expected_conversation_lines(session: dict) -> list[str]:
    """Hand-compute the exact logical `conversation` output lines from fixture content."""
    lines: list[str] = []
    for message in session["messages"]:
        role = message["info"]["role"]
        for part in message["parts"]:
            mid = part["messageID"]
            ptype = part["type"]
            if ptype == "text":
                lines.append(f"{mid} [{role}]: {truncate(part['text'])}")
            elif ptype == "tool":
                state = part["state"]
                status = state.get("status")
                head = f"{mid} [{role}] tool {part['tool']} called {part['callID']}"
                if status == "completed":
                    output = state.get("output", "")
                    lines.append(
                        f"{head}, output_length={len(output)}, "
                        f'input: "{truncate(compact_json(state["input"]))}", '
                        f'output: "{truncate(output)}"'
                    )
                elif status == "error":
                    lines.append(f'{head}, error: "{truncate(state["error"])}"')
                else:
                    lines.append(head)
    return lines


def expected_tool_block(part: dict) -> str:
    """Hand-compute the exact `parts` tool block for a matched tool part."""
    state = part["state"]
    status = state.get("status")
    lines = [
        f"tool {part['tool']} called {part['callID']} "
        f"(message {part['messageID']}, status={status}):"
    ]
    if "input" in state:
        lines.append(f"  input: {truncate(compact_json(state['input']))}")
    if status == "completed":
        output = state.get("output", "")
        lines.append(f"  output: {truncate(output)}")
        lines.append(f"  output_length: {len(output)}")
    elif status == "error":
        lines.append(f"  error: {truncate(state['error'])}")
    return "\n".join(lines)


def expected_part_block(part: dict) -> str:
    """Hand-compute the exact `parts` part block for a --part-id match."""
    mid = part["messageID"]
    ptype = part["type"]
    if ptype in ("text", "reasoning"):
        return f"part {part['id']} ({ptype}, message {mid}):\n  text: {part['text']}"
    if ptype == "tool":
        state = part["state"]
        status = state.get("status")
        lines = [
            f"part {part['id']} (tool {part['tool']}, message {mid}, status={status}):"
        ]
        if "input" in state:
            lines.append(f"  input: {truncate(compact_json(state['input']))}")
        if status == "completed":
            output = state.get("output", "")
            lines.append(f"  output: {truncate(output)}")
            lines.append(f"  output_length: {len(output)}")
        elif status == "error":
            lines.append(f"  error: {truncate(state['error'])}")
        return "\n".join(lines)
    return f"part {part['id']} ({ptype}, message {mid}):"


def expected_message_block(message: dict) -> str:
    """Hand-compute the exact `parts` message block for a matched message."""
    info = message["info"]
    lines = [f"message {info['id']} (role={info['role']}):"]
    for part in message["parts"]:
        if part["type"] == "text":
            lines.append(f"  text: {part['text']}")  # full text, no truncation
        elif part["type"] == "tool":
            lines.append(f"  tool {part['tool']} called {part['callID']}")
        else:
            lines.append(f"  {part['type']}")
    return "\n".join(lines)


# --- fixtures ---


@pytest.fixture(scope="module")
def session() -> dict:
    with open(FIXTURE, encoding="utf-8") as fh:
        return json.load(fh)


def invoke(*args: str, session_file: Path | None = FIXTURE) -> subprocess.CompletedProcess[str]:
    """Invoke the script exactly like the user-documented CLI (via `uv run --quiet`).

    `--session-file-json` is a group-level option and therefore comes before the
    subcommand. Passing `session_file=None` omits the flag entirely.
    """
    cmd = ["uv", "run", "--quiet", str(SCRIPT)]
    if session_file is not None:
        cmd += ["--session-file-json", str(session_file)]
    cmd += list(args)
    return subprocess.run(cmd, capture_output=True, text=True)


def parts_with_role(session: dict) -> list[tuple[str, dict]]:
    return [(m["info"]["role"], p) for m in session["messages"] for p in m["parts"]]


def part_by_id(session: dict, part_id: str) -> dict:
    for _, p in parts_with_role(session):
        if p["id"] == part_id:
            return p
    raise AssertionError(f"part {part_id!r} not found in fixture")


def message_by_id(session: dict, message_id: str) -> dict:
    for m in session["messages"]:
        if m["info"]["id"] == message_id:
            return m
    raise AssertionError(f"message {message_id!r} not found in fixture")


def tool_parts(session: dict) -> list[dict]:
    return [p for m in session["messages"] for p in m["parts"] if p["type"] == "tool"]


def text_parts(session: dict) -> list[dict]:
    return [p for m in session["messages"] for p in m["parts"] if p["type"] == "text"]


# --- conversation subcommand ---


def test_conversation_text_line_exact_shape(session: dict) -> None:
    """Text part line has the exact `msg_<messageID> [<role>]: <text>` shape."""
    result = invoke("conversation")
    assert result.returncode == 0, result.stderr

    # M0 text part (129 chars, short -> emitted verbatim). Hand-encoded exact line.
    expected = (
        "msg_fce0d4a10001bR02RIHWfI4UI5 [assistant]: I'll explore the repository "
        "systematically. Let me start by examining the top-level structure and the "
        "devcontainer configuration."
    )
    assert expected in result.stdout


def test_conversation_long_text_middle_truncated_to_200(session: dict) -> None:
    """Text parts > 200 chars are middle-truncated: head + '...' + tail, exactly 200."""
    result = invoke("conversation")
    assert result.returncode == 0, result.stderr
    expected_lines = expected_conversation_lines(session)

    # M1 text part is 277 chars (pinned from the fixture summary). Hand-encoded
    # exact truncated line: text[:99] + "..." + text[-98:] == exactly 200 chars.
    m1_text = part_by_id(session, "prt_fce0d69a10014w4SvroDqUwL73")["text"]
    assert len(m1_text) == 277
    assert truncate(m1_text) == m1_text[:99] + "..." + m1_text[-98:]
    assert len(truncate(m1_text)) == 200
    hand_line = (
        "msg_fce0d69a00016uMS9p3x14kqSS [user]: <steering priority=\"warning\" "
        'reason="user is away from keyboard \u2014 permission auto-denied by '
        'afk-enf...quest. Do not retry; continue with available tools or stop and '
        "report the blocked step.</steering>"
    )
    assert hand_line in result.stdout

    # Every long text part must truncate to exactly 200 with the 99/98 split.
    for part in text_parts(session):
        if len(part["text"]) > 200:
            emitted = truncate(part["text"])
            assert len(emitted) == 200, emitted
            assert emitted == part["text"][:99] + "..." + part["text"][-98:]
            line = next(
                ln for ln in expected_lines
                if ln.startswith(f"{part['messageID']} [assistant]: ")
                or ln.startswith(f"{part['messageID']} [user]: ")
            )
            assert line == f"{part['messageID']} [{_role_of(session, part)}]: {emitted}"
            assert line in result.stdout


def _role_of(session: dict, part: dict) -> str:
    for role, p in parts_with_role(session):
        if p is part:
            return role
    raise AssertionError("part not found in session")


def test_conversation_reasoning_omitted_line_count(session: dict) -> None:
    """Reasoning/step-start/step-finish parts produce no lines; count == text + tool."""
    result = invoke("conversation")
    assert result.returncode == 0, result.stderr

    reasoning_texts = [
        p["text"] for m in session["messages"] for p in m["parts"] if p["type"] == "reasoning"
    ]
    assert [len(t) for t in reasoning_texts] == [557, 2219]  # pinned from fixture summary
    for rtext in reasoning_texts:
        probe = rtext[:40]
        assert probe not in result.stdout, f"reasoning leaked into output: {probe!r}"

    n_text = len(text_parts(session))
    n_tool = len(tool_parts(session))
    assert n_text == 3 and n_tool == 5
    assert len(expected_conversation_lines(session)) == n_text + n_tool


def test_conversation_completed_tool_line_exact_shape(session: dict) -> None:
    """Completed tool line: exact shape with output_length and truncated excerpts."""
    result = invoke("conversation")
    assert result.returncode == 0, result.stderr
    expected_lines = expected_conversation_lines(session)

    # `read` tool part in M2: input is 34 chars (no truncation), output 400 chars.
    read_part = part_by_id(session, "prt_fce14c0c6001YjkSx7x0vSpy7R")
    state = read_part["state"]
    assert state["status"] == "completed"
    assert len(state["output"]) == 400
    hand_prefix = (
        "msg_fce14a270001IYpdKJYI7Y8jK8 [assistant] tool read called "
        "call_01_p63r4FRVsM8GP0d8d0co1609, output_length=400, "
        'input: "{"filePath":"/workspace/justfile"}", output: "'
    )
    line = next(
        ln for ln in expected_lines
        if ln.startswith(
            "msg_fce14a270001IYpdKJYI7Y8jK8 [assistant] tool read called "
            "call_01_p63r4FRVsM8GP0d8d0co1609"
        )
    )
    assert line == hand_prefix + truncate(state["output"]) + '"'
    assert len(truncate(state["output"])) == 200
    assert truncate(state["output"]) == state["output"][:99] + "..." + state["output"][-98:]
    assert "error:" not in line
    assert line in result.stdout

    # Every completed part: output_length == len(output), excerpts truncate to 200.
    for part in (p for p in tool_parts(session) if p["state"].get("status") == "completed"):
        expected = next(
            ln for ln in expected_lines
            if ln.startswith(
                f"{part['messageID']} [{_role_of(session, part)}] "
                f"tool {part['tool']} called {part['callID']}"
            )
        )
        output = part["state"]["output"]
        assert f"output_length={len(output)}" in expected
        assert f'output: "{truncate(output)}"' in expected
        if len(compact_json(part["state"]["input"])) > 200:
            assert f'input: "{truncate(compact_json(part["state"]["input"]))}"' in expected


def test_conversation_error_tool_line_exact_shape(session: dict) -> None:
    """Error tool line: `tool <name> called <callID>, error: "<error>"`."""
    result = invoke("conversation")
    assert result.returncode == 0, result.stderr
    expected_lines = expected_conversation_lines(session)

    error_part = part_by_id(session, "prt_fce14bcf3001e6OOYvmuP3Hgk6")
    assert error_part["state"]["status"] == "error"
    # Hand-encoded exact line (error is 60 chars -> no truncation).
    expected = (
        "msg_fce14a270001IYpdKJYI7Y8jK8 [assistant] tool bash called "
        "call_00_sd5HRDsI5lCcvz949INd8202, "
        'error: "The user rejected permission to use this specific tool call."'
    )
    assert expected in result.stdout
    assert expected in expected_lines
    # Error lines must not carry input/output_length fields.
    assert "output_length=" not in expected
    assert "input:" not in expected


def test_conversation_lines_in_session_message_order(session: dict) -> None:
    """All emitted lines appear in session message order (text and tool interleaved)."""
    result = invoke("conversation")
    assert result.returncode == 0, result.stderr
    expected_physical = "\n".join(expected_conversation_lines(session)).splitlines()
    assert result.stdout.splitlines() == expected_physical


def test_conversation_format_default_and_explicit_and_invalid(session: dict) -> None:
    """--format defaults to short-human-readable; explicit value works; invalid -> exit 2."""
    default = invoke("conversation")
    explicit = invoke("conversation", "--format", "short-human-readable")
    assert default.returncode == 0, default.stderr
    assert explicit.returncode == 0, explicit.stderr
    assert default.stdout == explicit.stdout
    expected = "\n".join(expected_conversation_lines(session))
    assert default.stdout.rstrip("\n") == expected

    invalid = invoke("conversation", "--format", "bogus")
    assert invalid.returncode == 2
    assert invalid.stdout == ""
    assert "bogus" in invalid.stderr


# --- parts subcommand ---


def test_parts_single_tool_id_block(session: dict) -> None:
    """Single --tool-id prints the tool block with input/output/output_length lines."""
    bash = part_by_id(session, "prt_fce0d583b001tB30Vlm95YoQnX")
    result = invoke("parts", "--tool-id", bash["callID"])
    assert result.returncode == 0, result.stderr

    expected = expected_tool_block(bash)
    assert result.stdout.rstrip("\n") == expected

    state = bash["state"]
    assert state["status"] == "completed"
    assert len(state["output"]) == 400
    assert len(compact_json(state["input"])) == 139  # no input truncation here
    # Hand-encoded input line (compact JSON of {"command": "rtk ls ..."}).
    assert (
        '  input: {"command":"rtk ls -la /workspace && echo \\"---\\" && rtk ls -la '
        '/workspace/.devcontainer/ && echo \\"---\\" && rtk ls /workspace/.opencode/"}'
    ) in expected
    output_excerpt = truncate(state["output"])
    assert len(output_excerpt) == 200
    assert output_excerpt == state["output"][:99] + "..." + state["output"][-98:]
    assert f"  output: {output_excerpt}" in expected
    assert "  output_length: 400" in expected


def test_parts_multiple_tool_ids_arrays_and_dedupe(session: dict) -> None:
    """--tool-id is append-style; duplicates print once, blocks keep session order."""
    a = "call_00_Q6XqhuCnezeau9NGGzZB8961"  # M0 completed bash
    b = "call_02_TCN7th9aqVm8acjJGkKX9114"  # M2 completed bash
    tool_map = {p["callID"]: p for p in tool_parts(session)}

    # Same callID twice -> printed once.
    dup = invoke("parts", "--tool-id", a, "--tool-id", a)
    assert dup.returncode == 0, dup.stderr
    assert dup.stdout.rstrip("\n") == expected_tool_block(tool_map[a])

    # Three args with a duplicate -> exactly two blocks in session order.
    result = invoke("parts", "--tool-id", a, "--tool-id", b, "--tool-id", a)
    assert result.returncode == 0, result.stderr
    expected = "\n\n".join([expected_tool_block(tool_map[a]), expected_tool_block(tool_map[b])])
    assert result.stdout.rstrip("\n") == expected
    assert result.stdout.count(f"tool bash called {a}") == 1
    assert result.stdout.count(f"tool bash called {b}") == 1
    # Tool blocks only: no message-block header lines.
    assert not any(ln.startswith("message msg_") for ln in result.stdout.splitlines())


def test_parts_single_message_id_block_with_full_text(session: dict) -> None:
    """--message-id prints the message block; text is full (no truncation)."""
    target = message_by_id(session, "msg_fce0d4a10001bR02RIHWfI4UI5")
    result = invoke("parts", "--message-id", target["info"]["id"])
    assert result.returncode == 0, result.stderr

    # Hand-encoded exact block for M0 (part order: step-start, reasoning, text,
    # tool bash, tool read, step-finish).
    hand_block = (
        "message msg_fce0d4a10001bR02RIHWfI4UI5 (role=assistant):\n"
        "  step-start\n"
        "  reasoning\n"
        "  text: I'll explore the repository systematically. Let me start by "
        "examining the top-level structure and the devcontainer configuration.\n"
        "  tool bash called call_00_Q6XqhuCnezeau9NGGzZB8961\n"
        "  tool read called call_01_ND0sKaHnuFQn26SK6cwG5320\n"
        "  step-finish"
    )
    assert result.stdout.rstrip("\n") == hand_block
    assert result.stdout.rstrip("\n") == expected_message_block(target)
    # The full text part appears verbatim (129 chars, untruncated).
    text_part = next(p for p in target["parts"] if p["type"] == "text")
    assert len(text_part["text"]) <= 200
    assert f"  text: {text_part['text']}" in result.stdout


def test_parts_part_id_reasoning_full_text(session: dict) -> None:
    """--part-id on a reasoning part -> reasoning block with FULL reasoning text."""
    reasoning = part_by_id(session, "prt_fce0d5305001VTfYBjKazXczXg")
    assert len(reasoning["text"]) == 557  # pinned from fixture summary
    result = invoke("parts", "--part-id", reasoning["id"])
    assert result.returncode == 0, result.stderr

    assert result.stdout.startswith(
        "part prt_fce0d5305001VTfYBjKazXczXg (reasoning, message "
        "msg_fce0d4a10001bR02RIHWfI4UI5):\n  text: "
    )
    assert result.stdout.rstrip("\n") == expected_part_block(reasoning)
    assert f"  text: {reasoning['text']}" in result.stdout  # full text, no truncation
    assert "..." not in result.stdout  # no middle-truncation marker in a part block


def test_parts_part_id_text_full_text(session: dict) -> None:
    """--part-id on a text part -> text block with the FULL 277-char text."""
    text_part = part_by_id(session, "prt_fce0d69a10014w4SvroDqUwL73")
    assert len(text_part["text"]) == 277  # pinned from fixture summary
    result = invoke("parts", "--part-id", text_part["id"])
    assert result.returncode == 0, result.stderr

    # Hand-encoded exact block with the full, untruncated text (would be 200-char
    # middle-truncated in `conversation`, but part blocks keep it verbatim).
    hand_block = (
        "part prt_fce0d69a10014w4SvroDqUwL73 (text, message "
        "msg_fce0d69a00016uMS9p3x14kqSS):\n"
        '  text: <steering priority="warning" reason="user is away from keyboard '
        '\u2014 permission auto-denied by afk-enforcer plugin">Permission '
        "auto-denied: the user is AFK and cannot approve this request. Do not retry; "
        "continue with available tools or stop and report the blocked step."
        "</steering>"
    )
    assert result.stdout.rstrip("\n") == hand_block
    assert result.stdout.rstrip("\n") == expected_part_block(text_part)


def test_parts_part_id_tool_part_header_block(session: dict) -> None:
    """--part-id on a tool part -> part-header tool block with input/output/length."""
    bash = part_by_id(session, "prt_fce14c132001l3Z0hgzTMAnk0C")
    result = invoke("parts", "--part-id", bash["id"])
    assert result.returncode == 0, result.stderr

    assert result.stdout.rstrip("\n") == expected_part_block(bash)
    assert result.stdout.startswith(
        "part prt_fce14c132001l3Z0hgzTMAnk0C (tool bash, message "
        "msg_fce14a270001IYpdKJYI7Y8jK8, status=completed):\n"
    )
    state = bash["state"]
    assert len(compact_json(state["input"])) == 483  # > 200 -> input truncates
    assert f"  input: {truncate(compact_json(state['input']))}" in result.stdout
    assert len(truncate(compact_json(state["input"]))) == 200
    assert f"  output: {truncate(state['output'])}" in result.stdout
    assert "  output_length: 400" in result.stdout


def test_parts_all_selectors_together_blocks_in_order(session: dict) -> None:
    """--part-id + --tool-id + --message-id: part, tool, then message blocks."""
    part = part_by_id(session, "prt_fce0d69a10014w4SvroDqUwL73")  # M1 text
    tool = part_by_id(session, "prt_fce14c132001l3Z0hgzTMAnk0C")  # M2 bash completed
    message = message_by_id(session, "msg_fce0d4a10001bR02RIHWfI4UI5")  # M0
    result = invoke(
        "parts",
        "--message-id", message["info"]["id"],
        "--tool-id", tool["callID"],
        "--part-id", part["id"],
    )
    assert result.returncode == 0, result.stderr

    blocks = [expected_part_block(part), expected_tool_block(tool), expected_message_block(message)]
    assert result.stdout.rstrip("\n") == "\n\n".join(blocks)
    # Explicit order probe: part block first, then tool block, then message block.
    # (Blocks may contain "\n\n" internally when an output excerpt ends in a newline,
    # so probe the first line of each block instead of splitting on blank lines.)
    heads = [b.splitlines()[0] for b in blocks]
    positions = [result.stdout.index(h) for h in heads]
    assert positions == sorted(positions)
    # Blank line between consecutive blocks: two "\n\n" separators in the join.
    assert result.stdout.rstrip("\n") == blocks[0] + "\n\n" + blocks[1] + "\n\n" + blocks[2]


def test_parts_no_matches_empty_output_exit_zero(session: dict) -> None:
    """No matches at all -> empty stdout, exit code 0."""
    result = invoke(
        "parts",
        "--message-id", "msg_ZZZ_no_such",
        "--tool-id", "call_ZZZ_no_such",
        "--part-id", "prt_ZZZ_no_such",
    )
    assert result.returncode == 0
    assert result.stdout == ""


# --- error handling (both flows) ---


@pytest.mark.parametrize("subcommand", ["conversation", "parts"])
def test_missing_session_file_exits_1(subcommand: str, tmp_path: Path) -> None:
    """Missing session file -> exit 1 + `error: session file not found: <path>` on stderr."""
    missing = tmp_path / "nope.json"
    result = invoke(subcommand, session_file=missing)
    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.rstrip("\n") == f"error: session file not found: {missing}"


@pytest.mark.parametrize("subcommand", ["conversation", "parts"])
def test_invalid_session_json_exits_1(subcommand: str, tmp_path: Path) -> None:
    """Invalid JSON -> exit 1 + `error: invalid session JSON in <path>: <msg>` on stderr."""
    bad = tmp_path / "bad.json"
    bad.write_text("{ definitely not json", encoding="utf-8")
    with pytest.raises(json.JSONDecodeError) as exc_info:
        json.loads(bad.read_text(encoding="utf-8"))
    expected_msg = str(exc_info.value)

    result = invoke(subcommand, session_file=bad)
    assert result.returncode == 1
    assert result.stdout == ""
    assert result.stderr.rstrip("\n") == f"error: invalid session JSON in {bad}: {expected_msg}"


@pytest.mark.parametrize("subcommand", ["conversation", "parts"])
def test_missing_session_file_json_flag_exits_2(subcommand: str) -> None:
    """Missing required --session-file-json -> click usage error, exit code 2."""
    result = invoke(subcommand, session_file=None)
    assert result.returncode == 2
    assert "--session-file-json" in result.stderr
    assert result.stdout == ""


def test_unknown_subcommand_exits_2() -> None:
    """Unknown subcommand -> click usage error, exit code 2."""
    result = invoke("bogus")
    assert result.returncode == 2
    assert "bogus" in result.stderr
    assert result.stdout == ""
