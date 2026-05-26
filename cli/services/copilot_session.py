from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass, field
from typing import Any

__all__ = [
    "CopilotSessionService",
    "DISCOVER_TOOLSET",
    "PERMISSIVE_TOOLSET",
    "PROMPT_ARG_MAX_BYTES",
    "RESTRICTED_TOOLSET",
    "SessionResult",
    "ToolCall",
    "Toolset",
    "allow_all_deny_git_toolset",
]


# Keep a conservative cap so prompt argv usage stays well under common per-argument limits.
PROMPT_ARG_MAX_BYTES = 64 * 1024


@dataclass
class Toolset:
    """Configuration for allowed and denied tools in a Copilot session."""

    allow_all: bool = False
    denied_tools: list[str] = field(default_factory=list)
    allowed_tools: list[str] = field(default_factory=list)

    def to_flags(self, inline_assignment: bool = False) -> list[str]:
        flags = []
        if self.allow_all:
            flags.append("--allow-all-tools")
        for tool in self.denied_tools:
            if inline_assignment:
                flags.append(f"--deny-tool={tool}")
            else:
                flags.extend(["--deny-tool", tool])
        for tool in self.allowed_tools:
            if inline_assignment:
                flags.append(f"--allow-tool={tool}")
            else:
                flags.extend(["--allow-tool", tool])
        return flags


# Restricted toolset: No shell tools by default, but permits some read-only ones if needed.
# For now, we'll start very restricted.
RESTRICTED_TOOLSET = Toolset(allow_all=False)


def allow_all_deny_git_toolset() -> Toolset:
    return Toolset(
        allow_all=True,
        denied_tools=["shell(git push)", "shell(git commit)", "shell(git checkout)"],
    )


# Permissive toolset as seen in fix_code.sh
PERMISSIVE_TOOLSET = allow_all_deny_git_toolset()

# Discover toolset: only file reading and writing — papers are pre-fetched into the prompt.
DISCOVER_TOOLSET = Toolset(
    allow_all=False,
    allowed_tools=["read_file", "write_file"],
)


@dataclass
class ToolCall:
    """Represents a tool call requested by the agent."""

    id: str
    name: str
    arguments: dict[str, Any]


@dataclass
class SessionResult:
    """Result of a Copilot CLI session execution."""

    stdout: str
    stderr: str
    returncode: int
    session_id: str | None = None
    tool_calls: list[ToolCall] = field(default_factory=list)

    @property
    def is_success(self) -> bool:
        return self.returncode == 0


class CopilotSessionService:
    """Service to interact with the GitHub Copilot CLI."""

    def __init__(
        self,
        alias: str = "copilot",
        model: str = "gpt-5-mini",
        toolset: Toolset | None = None,
        agent: str | None = None,
    ):
        self.alias = alias
        self.model = model
        self.agent = agent
        self.session_id: str | None = None
        self.toolset = toolset or RESTRICTED_TOOLSET

    def change_toolset(self, toolset: Toolset) -> None:
        """Update the toolset for subsequent messages in this session."""
        self.toolset = toolset

    def send_message(
        self,
        prompt: str,
        silent: bool = True,
        agent: str | None = None,
        continue_session: bool = False,
    ) -> SessionResult:
        """
        Sends a message to Copilot CLI in non-interactive mode.
        """
        cmd = [
            self.alias,
            "--model",
            self.model,
        ]
        run_input: str | None = None

        # Use explicitly provided agent, or default from __init__
        target_agent = agent or self.agent
        if target_agent:
            cmd.extend(["--agent", target_agent])

        if self._should_send_prompt_via_stdin(prompt):
            run_input = prompt
        else:
            cmd.extend(["--prompt", prompt])

        cmd.extend(
            [
                "--output-format",
                "json",
                "--autopilot",
                "--yolo",
            ]
        )

        # Add toolset flags
        cmd.extend(self.toolset.to_flags())

        if self.session_id:
            cmd.append(f"--resume={self.session_id}")
        elif continue_session:
            cmd.append("--continue")

        if silent:
            cmd.append("--silent")

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
                input=run_input,
            )

            result = self._parse_jsonl(res.stdout, res.stderr, res.returncode)

            if result.session_id:
                self.session_id = result.session_id
            return result
        except FileNotFoundError:
            return SessionResult(
                stdout="", stderr=f"Command '{self.alias}' not found in PATH.", returncode=127
            )

    def _should_send_prompt_via_stdin(self, prompt: str) -> bool:
        return len(prompt.encode("utf-8")) > PROMPT_ARG_MAX_BYTES

    def _parse_jsonl(self, stdout: str, stderr: str, returncode: int) -> SessionResult:
        """Parses the JSONL output from Copilot CLI."""
        final_content = ""
        tool_calls = []
        session_id = None

        for line in stdout.splitlines():
            if not line.strip():
                continue
            try:
                event = json.loads(line)
                event_type = event.get("type")
                data = event.get("data", {})

                if event_type == "assistant.message":
                    final_content = data.get("content", "")
                    requests = data.get("toolRequests", [])
                    for req in requests:
                        tool_calls.append(
                            ToolCall(
                                id=req.get("toolCallId", ""),
                                name=req.get("name", ""),
                                arguments=req.get("arguments", {}),
                            )
                        )
                elif event_type == "session.started":
                    session_id = data.get("sessionId") or event.get("sessionId") or session_id
                elif event_type == "result":
                    session_id = event.get("sessionId") or data.get("sessionId") or session_id
            except json.JSONDecodeError:
                continue

        return SessionResult(
            stdout=final_content,
            stderr=stderr,
            returncode=returncode,
            session_id=session_id,
            tool_calls=tool_calls,
        )
