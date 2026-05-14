from __future__ import annotations

import shlex
import subprocess
import tomllib
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

import click

from cli.services.copilot_session import PERMISSIVE_TOOLSET, CopilotSessionService

from .command_context import build_command_context


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


def run_fix(
    autofix_config: str,
    config_path: str | None = None,
    continue_session: bool = False,
    parallel: bool = False,
) -> None:
    """Run the autofix workflow defined in the TOML config file."""
    autofix_config_path = Path(autofix_config)
    hook_specs = _load_hook_specs(autofix_config_path)
    if not hook_specs:
        click.echo(
            f"No autofix hooks are configured in {autofix_config_path}.\n"
            "Add one or more [[hooks]] entries to "
            f"{autofix_config_path} or pass --autofix-config <path>."
        )
        return

    command_context = build_command_context(
        config_path=config_path,
        required=False,
        model="gpt-5-mini",
        toolset=PERMISSIVE_TOOLSET,
    )
    copilot_session = command_context.copilot_session
    resume_prior_session_on_first_fallback = continue_session

    if parallel:
        _run_hooks_in_parallel(
            hook_specs,
            copilot_session,
            continue_session=resume_prior_session_on_first_fallback,
        )
        click.echo("All autofix stages completed successfully.")
        return

    total_hooks = len(hook_specs)
    for index, hook_spec in enumerate(hook_specs, start=1):
        click.echo(f"[{index}/{total_hooks}] Running {hook_spec.name}...")
        used_fallback = _run_hook(
            hook_spec,
            copilot_session,
            continue_session=resume_prior_session_on_first_fallback,
            position=index,
            total=total_hooks,
        )
        if used_fallback:
            resume_prior_session_on_first_fallback = False

    click.echo("All autofix stages completed successfully.")


def _load_hook_specs(config_path: Path) -> list[HookSpec]:
    if not config_path.exists():
        return []

    try:
        with config_path.open("rb") as config_file:
            parsed_config = tomllib.load(config_file)
    except tomllib.TOMLDecodeError as exc:
        raise click.ClickException(f"Invalid autofix config: {exc}") from exc

    configured_hooks = parsed_config.get("hooks", [])
    if not isinstance(configured_hooks, list):
        raise click.ClickException("Invalid autofix config: 'hooks' must be an array of tables.")

    hook_specs: list[HookSpec] = []
    for index, hook_config in enumerate(configured_hooks, start=1):
        if not isinstance(hook_config, dict):
            raise click.ClickException(
                f"Invalid autofix config: hook #{index} must be a TOML table."
            )

        name = _require_non_empty_string(hook_config.get("name"), index, "name")
        command = _require_non_empty_string(hook_config.get("command"), index, "command")
        remediation_prompt = _require_non_empty_string(
            hook_config.get("remediation_prompt"),
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
    copilot_session: CopilotSessionService,
    *,
    continue_session: bool,
    position: int,
    total: int,
) -> bool:
    hook_run_result = _run_command(hook.command)
    if hook_run_result.returncode == 0:
        click.echo(f"[{position}/{total}] {hook.name} passed.")
        return False

    click.echo(f"[{position}/{total}] {hook.name} failed. Requesting remediation...")
    prompt = _build_remediation_prompt(hook, hook_run_result.stdout, hook_run_result.stderr)
    remediation_result = copilot_session.send_message(
        prompt,
        output_format="json",
        continue_session=continue_session,
    )
    if not remediation_result.is_success:
        remediation_error_detail = (
            remediation_result.stderr.strip() or "Copilot remediation failed."
        )
        raise click.ClickException(
            f"Autofix remediation failed for '{hook.name}': {remediation_error_detail}"
        )

    click.echo(f"[{position}/{total}] Retrying {hook.name}...")
    retry_result = _run_command(hook.command)
    if retry_result.returncode != 0:
        raise click.ClickException(
            f"Autofix step '{hook.name}' still failed after remediation.\n"
            f"{_format_output(retry_result.stdout, retry_result.stderr)}"
        )

    click.echo(f"[{position}/{total}] {hook.name} passed after remediation.")
    return True


def _run_hooks_in_parallel(
    hooks: list[HookSpec],
    copilot_session: CopilotSessionService,
    *,
    continue_session: bool,
) -> None:
    click.echo(f"Running first pass for {len(hooks)} autofix hooks in parallel...")
    first_pass_failures = _run_hooks_first_pass(hooks)
    if not first_pass_failures:
        return

    suffix = "s" if len(first_pass_failures) != 1 else ""
    click.echo(f"Running remediation for {len(first_pass_failures)} failed hook{suffix}...")
    prompt = _build_batch_remediation_prompt(first_pass_failures)
    remediation_result = copilot_session.send_message(
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
        ordered_failures: list[HookFailure | None] = [None] * len(hooks)
        total_hooks = len(hooks)

        for future in as_completed(future_to_index):
            index = future_to_index[future]
            hook = hooks[index]
            hook_run_result = future.result()
            position = index + 1

            if hook_run_result.returncode != 0:
                click.echo(f"[first pass {position}/{total_hooks}] {hook.name} failed.")
                ordered_failures[index] = HookFailure(
                    hook=hook,
                    stdout=hook_run_result.stdout,
                    stderr=hook_run_result.stderr,
                )
                continue
            click.echo(f"[first pass {position}/{total_hooks}] {hook.name} passed.")

    return [failure for failure in ordered_failures if failure is not None]


def _rerun_failed_hooks(failures: list[HookFailure]) -> list[HookFailure]:
    remaining_failures: list[HookFailure] = []
    total_failures = len(failures)
    for index, failure in enumerate(failures, start=1):
        click.echo(f"[retry {index}/{total_failures}] Retrying {failure.hook.name}...")
        retry_result = _run_command(failure.hook.command)
        if retry_result.returncode != 0:
            click.echo(f"[retry {index}/{total_failures}] {failure.hook.name} still failed.")
            remaining_failures.append(
                HookFailure(
                    hook=failure.hook,
                    stdout=retry_result.stdout,
                    stderr=retry_result.stderr,
                )
            )
            continue
        click.echo(
            f"[retry {index}/{total_failures}] {failure.hook.name} passed after remediation."
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
