from __future__ import annotations

import json
from unittest.mock import MagicMock, patch

from cli.services import copilot_session as copilot_session_module
from cli.services.copilot_session import (
    PERMISSIVE_TOOLSET,
    CopilotSessionService,
    PROMPT_ARG_MAX_BYTES,
    Toolset,
)


def test_session_agent_config() -> None:
    """Test that agent flag is correctly added to the command from init."""
    service = CopilotSessionService(agent="custom-agent")

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)
        service.send_message("test")

        args = mock_run.call_args[0][0]
        assert "--agent" in args
        assert "custom-agent" in args


def test_session_agent_override() -> None:
    """Test that agent can be overridden per message."""
    service = CopilotSessionService(agent="initial-agent")

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)
        service.send_message("test", agent="overridden-agent")

        args = mock_run.call_args[0][0]
        assert "--agent" in args
        assert "overridden-agent" in args
        assert "initial-agent" not in args


def test_session_service_success() -> None:
    service = CopilotSessionService(alias="test-copilot", model="test-model")

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="success response", stderr="", returncode=0)

        result = service.send_message("test prompt")

        assert result.is_success
        assert result.stdout == "success response"
        mock_run.assert_called_once()
        args = mock_run.call_args[0][0]
        assert "test-copilot" in args
        assert "test-model" in args
        assert "test prompt" in args


def test_session_service_json_parsing() -> None:
    """Test parsing of JSONL output to extract messages and tools."""
    service = CopilotSessionService()

    # Mock JSONL output
    jsonl_output = "\n".join(
        [
            json.dumps({"type": "session.started", "data": {"sessionId": "s1"}}),
            json.dumps(
                {
                    "type": "assistant.message",
                    "data": {
                        "content": "I am looking for files.",
                        "toolRequests": [
                            {
                                "toolCallId": "c1",
                                "name": "ls",
                                "arguments": {"path": "."},
                                "type": "function",
                            }
                        ],
                    },
                }
            ),
            json.dumps({"type": "result", "exitCode": 0}),
        ]
    )

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout=jsonl_output, stderr="", returncode=0)

        result = service.send_message("list files", output_format="json")

        assert result.is_success
        assert result.stdout == "I am looking for files."
        assert len(result.tool_calls) == 1
        assert result.tool_calls[0].name == "ls"
        assert result.tool_calls[0].arguments == {"path": "."}


def test_session_persistence() -> None:
    """Test that session_id is preserved from first response to second request."""
    service = CopilotSessionService()

    # First response returns a sessionId
    first_jsonl = json.dumps({"type": "result", "sessionId": "remote-id-123"})
    # Second request should include it
    second_jsonl = json.dumps({"type": "result", "sessionId": "remote-id-123"})

    with patch("subprocess.run") as mock_run:
        # First call mocks
        mock_run.side_effect = [
            MagicMock(stdout=first_jsonl, stderr="", returncode=0),
            MagicMock(stdout=second_jsonl, stderr="", returncode=0),
        ]

        # First message (no session_id in command initially)
        service.send_message("first", output_format="json")
        assert service.session_id == "remote-id-123"

        args1 = mock_run.call_args_list[0][0][0]
        # In the command list, --resume= should NOT be there.
        # But our toolset flags ARE there.
        assert not any(arg.startswith("--resume") for arg in args1)

        # Second message should use the session_id from the first call via --resume=ID
        service.send_message("second", output_format="json")
        assert service.session_id == "remote-id-123"

        args2 = mock_run.call_args_list[1][0][0]
        assert "--resume=remote-id-123" in args2


def test_session_service_supports_initial_continue_without_session_id() -> None:
    service = CopilotSessionService()

    first_jsonl = json.dumps({"type": "result", "sessionId": "remote-id-123"})

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout=first_jsonl, stderr="", returncode=0)

        service.send_message("first", output_format="json", continue_session=True)

        args = mock_run.call_args[0][0]
        assert "--continue" in args
        assert not any(arg.startswith("--resume") for arg in args)
        assert service.session_id == "remote-id-123"


def test_session_service_reuses_persisted_session_after_initial_continue() -> None:
    service = CopilotSessionService()

    first_jsonl = json.dumps({"type": "result", "sessionId": "remote-id-123"})
    second_jsonl = json.dumps({"type": "result", "sessionId": "remote-id-123"})

    with patch("subprocess.run") as mock_run:
        mock_run.side_effect = [
            MagicMock(stdout=first_jsonl, stderr="", returncode=0),
            MagicMock(stdout=second_jsonl, stderr="", returncode=0),
        ]

        service.send_message("first", output_format="json", continue_session=True)
        service.send_message("second", output_format="json", continue_session=True)

        args1 = mock_run.call_args_list[0][0][0]
        assert "--continue" in args1
        assert not any(arg.startswith("--resume") for arg in args1)

        args2 = mock_run.call_args_list[1][0][0]
        assert "--resume=remote-id-123" in args2
        assert "--continue" not in args2


def test_session_toolset_config() -> None:
    """Test that toolset flags are correctly added to the command."""
    toolset = Toolset(allow_all=True, denied_tools=["git push"])
    service = CopilotSessionService(toolset=toolset)

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)
        service.send_message("test")

        args = mock_run.call_args[0][0]
        assert "--allow-all-tools" in args
        assert "--deny-tool" in args
        assert "git push" in args


def test_session_change_toolset() -> None:
    """Test that toolset can be changed between messages."""
    service = CopilotSessionService()  # Default is restricted

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)

        # First message: restricted
        service.send_message("first")
        args1 = mock_run.call_args[0][0]
        assert "--allow-all-tools" not in args1

        # Change to permissive
        service.change_toolset(PERMISSIVE_TOOLSET)
        service.send_message("second")
        args2 = mock_run.call_args[0][0]
        assert "--allow-all-tools" in args2
        assert "shell(git push)" in args2


def test_allow_all_deny_git_toolset_returns_expected_flags() -> None:
    assert copilot_session_module.allow_all_deny_git_toolset().to_flags() == [
        "--allow-all-tools",
        "--deny-tool",
        "shell(git push)",
        "--deny-tool",
        "shell(git commit)",
        "--deny-tool",
        "shell(git checkout)",
    ]


def test_session_service_failure() -> None:
    service = CopilotSessionService(alias="test-copilot")

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="authentication error", returncode=1)

        result = service.send_message("hi")

        assert not result.is_success
        assert result.stderr == "authentication error"
        assert result.returncode == 1


def test_session_service_not_found() -> None:
    service = CopilotSessionService(alias="non-existent")

    with patch("subprocess.run", side_effect=FileNotFoundError):
        result = service.send_message("hi")

        assert not result.is_success
        assert "not found in PATH" in result.stderr
        assert result.returncode == 127


def test_discover_toolset_flags() -> None:
    from cli.services.copilot_session import DISCOVER_TOOLSET

    assert DISCOVER_TOOLSET.to_flags() == [
        "--allow-tool",
        "read_file",
        "--allow-tool",
        "write_file",
    ]


def test_discover_toolset_no_allow_all() -> None:
    from cli.services.copilot_session import DISCOVER_TOOLSET

    flags = DISCOVER_TOOLSET.to_flags()
    assert "--allow-all-tools" not in flags


def test_small_prompt_uses_argv_prompt_flag() -> None:
    service = CopilotSessionService()

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)

        service.send_message("small prompt")

        args = mock_run.call_args[0][0]
        kwargs = mock_run.call_args.kwargs
        assert "--prompt" in args
        assert "small prompt" in args
        assert kwargs.get("input") is None


def test_large_prompt_uses_stdin_not_argv_and_keeps_session_tool_flags() -> None:
    service = CopilotSessionService(
        toolset=Toolset(allow_all=True, denied_tools=["shell(git push)"])
    )
    service.session_id = "remote-id-456"
    prompt = "x" * (PROMPT_ARG_MAX_BYTES + 1)

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)

        service.send_message(prompt, output_format="json")

        args = mock_run.call_args[0][0]
        kwargs = mock_run.call_args.kwargs
        assert "--prompt" not in args
        assert prompt not in args
        assert kwargs.get("input") == prompt
        assert "--resume=remote-id-456" in args
        assert "--allow-all-tools" in args
        assert "--deny-tool" in args
        assert "shell(git push)" in args
        assert "--output-format" in args
        assert "json" in args


def test_large_prompt_with_initial_continue_uses_stdin_and_keeps_continue() -> None:
    service = CopilotSessionService()
    prompt = "x" * (PROMPT_ARG_MAX_BYTES + 1)

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout="", stderr="", returncode=0)

        service.send_message(prompt, continue_session=True)

        args = mock_run.call_args[0][0]
        kwargs = mock_run.call_args.kwargs
        assert "--continue" in args
        assert not any(arg.startswith("--resume") for arg in args)
        assert "--prompt" not in args
        assert kwargs.get("input") == prompt


def test_large_prompt_json_output_parses_response() -> None:
    service = CopilotSessionService()
    prompt = "x" * (PROMPT_ARG_MAX_BYTES + 1)
    jsonl_output = "\n".join(
        [
            json.dumps(
                {
                    "type": "assistant.message",
                    "data": {
                        "content": "stdin path works",
                        "toolRequests": [
                            {
                                "toolCallId": "c1",
                                "name": "read_file",
                                "arguments": {"filePath": "README.md"},
                            }
                        ],
                    },
                }
            ),
            json.dumps({"type": "result", "sessionId": "session-from-stdin"}),
        ]
    )

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(stdout=jsonl_output, stderr="", returncode=0)

        result = service.send_message(prompt, output_format="json")

        args = mock_run.call_args[0][0]
        kwargs = mock_run.call_args.kwargs
        assert "--prompt" not in args
        assert kwargs.get("input") == prompt
        assert result.stdout == "stdin path works"
        assert len(result.tool_calls) == 1
        assert result.tool_calls[0].name == "read_file"
        assert service.session_id == "session-from-stdin"
