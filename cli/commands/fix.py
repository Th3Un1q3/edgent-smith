from __future__ import annotations

import shlex
import subprocess
import tomllib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

import click

from cli.services.copilot_session import PERMISSIVE_TOOLSET, CopilotSessionService


@dataclass(frozen=True)
class HookSpec:
    name: str
    command: str
    remediation_prompt: str


@dataclass(frozen=True)
class HookFailure:
    hook: HookSpec
    stdout: str
    stderr: str


def run_fix(autofix_config: str, continue_session: bool = False, parallel: bool = False) -> None:
    """Run the autofix workflow defined in the TOML config file."""
    config_path = Path(autofix_config)
    hooks = _load_hook_specs(config_path)
    if not hooks:
        click.echo(
            f"No autofix hooks are configured in {config_path}.\n"
            f"Add one or more [[hooks]] entries to {config_path} or pass --autofix-config <path>."
        )
        return

    service = CopilotSessionService(alias="copilot", model="gpt-5-mini", toolset=PERMISSIVE_TOOLSET)
    resume_first_fallback = continue_session

    if parallel:
        _run_hooks_in_parallel(hooks, service, continue_session=resume_first_fallback)
        click.echo("All autofix stages completed successfully.")
        return

    for hook in hooks:
        used_fallback = _run_hook(hook, service, continue_session=resume_first_fallback)
        if used_fallback:
            resume_first_fallback = False

    click.echo("All autofix stages completed successfully.")


def _load_hook_specs(config_path: Path) -> list[HookSpec]:
    if not config_path.exists():
        return []

    try:
        with config_path.open("rb") as config_file:
            config = tomllib.load(config_file)
    except tomllib.TOMLDecodeError as exc:
        raise click.ClickException(f"Invalid autofix config: {exc}") from exc

    hooks = config.get("hooks", [])
    if not isinstance(hooks, list):
        raise click.ClickException("Invalid autofix config: 'hooks' must be an array of tables.")

    hook_specs: list[HookSpec] = []
    for index, hook in enumerate(hooks, start=1):
        if not isinstance(hook, dict):
            raise click.ClickException(
                f"Invalid autofix config: hook #{index} must be a TOML table."
            )

        name = _require_non_empty_string(hook.get("name"), index, "name")
        command = _require_non_empty_string(hook.get("command"), index, "command")
        remediation_prompt = _require_non_empty_string(
            hook.get("remediation_prompt"),
            index,
            "remediation_prompt",
        )

        hook_specs.append(
            HookSpec(
                name=name,
                command=command,
                remediation_prompt=remediation_prompt,
            )
        )

    return hook_specs


def _is_non_empty_string(value: object) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _require_non_empty_string(value: object, hook_index: int, field_name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise click.ClickException(
            f"Invalid autofix config: hook #{hook_index} is missing a non-empty '{field_name}'."
        )
    return value.strip()


def _run_hook(
    hook: HookSpec,
    service: CopilotSessionService,
    *,
    continue_session: bool,
) -> bool:
    result = _run_command(hook.command)
    if result.returncode == 0:
        return False

    prompt = _build_remediation_prompt(hook, result.stdout, result.stderr)
    remediation_result = service.send_message(
        prompt,
        output_format="json",
        continue_session=continue_session,
    )
    if not remediation_result.is_success:
        detail = remediation_result.stderr.strip() or "Copilot remediation failed."
        raise click.ClickException(f"Autofix remediation failed for '{hook.name}': {detail}")

    retry_result = _run_command(hook.command)
    if retry_result.returncode != 0:
        raise click.ClickException(
            f"Autofix step '{hook.name}' still failed after remediation.\n"
            f"{_format_output(retry_result.stdout, retry_result.stderr)}"
        )

    return True


def _run_hooks_in_parallel(
    hooks: list[HookSpec],
    service: CopilotSessionService,
    *,
    continue_session: bool,
) -> None:
    first_pass_failures = _run_hooks_first_pass(hooks)
    if not first_pass_failures:
        return

    prompt = _build_batch_remediation_prompt(first_pass_failures)
    remediation_result = service.send_message(
        prompt,
        output_format="json",
        continue_session=continue_session,
    )
    if not remediation_result.is_success:
        detail = remediation_result.stderr.strip() or "Copilot remediation failed."
        raise click.ClickException(f"Autofix remediation failed: {detail}")

    remaining_failures = _rerun_failed_hooks(first_pass_failures)
    if remaining_failures:
        raise click.ClickException(_build_parallel_failure_summary(remaining_failures))


def _run_hooks_first_pass(hooks: list[HookSpec]) -> list[HookFailure]:
    with ThreadPoolExecutor(max_workers=len(hooks)) as executor:
        future_to_index = {
            executor.submit(_run_command, hook.command): index for index, hook in enumerate(hooks)
        }
        ordered_results: list[subprocess.CompletedProcess[str] | None] = [None] * len(hooks)

        for future in as_completed(future_to_index):
            index = future_to_index[future]
            ordered_results[index] = future.result()

    failures: list[HookFailure] = []
    for hook, result in zip(hooks, ordered_results, strict=True):
        if result is None:
            raise click.ClickException(
                f"Autofix hook '{hook.name}' did not produce a first-pass result."
            )
        if result.returncode != 0:
            failures.append(HookFailure(hook=hook, stdout=result.stdout, stderr=result.stderr))
    return failures


def _rerun_failed_hooks(failures: list[HookFailure]) -> list[HookFailure]:
    remaining_failures: list[HookFailure] = []
    for failure in failures:
        retry_result = _run_command(failure.hook.command)
        if retry_result.returncode != 0:
            remaining_failures.append(
                HookFailure(
                    hook=failure.hook,
                    stdout=retry_result.stdout,
                    stderr=retry_result.stderr,
                )
            )
    return remaining_failures


def _build_batch_remediation_prompt(failures: list[HookFailure]) -> str:
    sections = [
        (
            "Multiple autofix hooks failed on the first pass. Resolve every failure "
            "below in one remediation pass before rerunning only those hooks."
        ),
    ]
    for failure in failures:
        sections.append(_build_remediation_prompt(failure.hook, failure.stdout, failure.stderr))
    return "\n\n---\n\n".join(sections)


def _build_parallel_failure_summary(failures: list[HookFailure]) -> str:
    lines = ["Autofix steps still failed after remediation:"]
    for failure in failures:
        lines.extend(
            [
                f"- {failure.hook.name} ({failure.hook.command})",
                _format_output(failure.stdout, failure.stderr),
            ]
        )
    return "\n".join(lines)


def _run_command(command: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        shlex.split(command),
        capture_output=True,
        text=True,
        check=False,
    )


def _build_remediation_prompt(hook: HookSpec, stdout: str, stderr: str) -> str:
    output = _format_output(stdout, stderr)
    rendered_prompt = _render_prompt_template(
        hook.remediation_prompt,
        command=hook.command,
        name=hook.name,
        stdout=stdout,
        stderr=stderr,
        output=output,
    )

    return "\n\n".join(
        [
            rendered_prompt,
            f"Hook name: {hook.name}",
            f"Command: {hook.command}",
            f"Captured stdout:\n{stdout or '(empty)'}",
            f"Captured stderr:\n{stderr or '(empty)'}",
            f"Combined output:\n{output}",
        ]
    )


def _render_prompt_template(
    template: str,
    *,
    command: str,
    name: str,
    stdout: str,
    stderr: str,
    output: str,
) -> str:
    rendered = template
    replacements = {
        "${hook_name}": name,
        "${hook_command}": command,
        "${hook_stdout}": stdout,
        "${hook_stderr}": stderr,
        "${hook_output}": output,
        "${stage_name}": name,
        "${stage_command}": command,
        "${stage_stdout}": stdout,
        "${stage_stderr}": stderr,
        "${stage_output}": output,
    }
    for placeholder, value in replacements.items():
        rendered = rendered.replace(placeholder, value)
    return rendered


def _format_output(stdout: str, stderr: str) -> str:
    parts = []
    if stdout.strip():
        parts.append(stdout.strip())
    if stderr.strip():
        parts.append(stderr.strip())
    if not parts:
        return "(no output captured)"
    return "\n".join(parts)
