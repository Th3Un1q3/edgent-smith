---
name: cli-structure
description: "CLI structure guide: defines file organization, placement rules, and anti-patterns for Click-backed CLI commands and services. Use when adding new commands, refactoring command logic, or moving utilities."
applyTo: "cli/**/*.py,tests/test_cli_*.py,tests/test_*_cli.py"
---

# CLI Structure and Organization

This repository uses a three-layer Click CLI with clear separation of concerns. Follow these rules to keep the codebase modular and testable.

## Layer 1: Command Routing (`cli/main.py`)

**Purpose:** Click command registration and group hierarchy.

**What goes here:**
- `@click.group()` and `@click.command()` decorators only
- Command option definitions (`@click.option()`, `@click.argument()`)
- Help text and descriptions
- Invocation of `run_*()` functions from command modules

**What does NOT go here:**
- Business logic or computation
- Service initialization (except passing to `run_*()` functions)
- Config loading or file I/O
- Error handling beyond Click's default behavior

**Example (correct):**
```python
from cli.commands.design import run_design

@autoresearch.command()
@click.argument("brief", required=False)
@click.option("--config", "config_path", help="Path to project config.")
def design(brief: str | None, config_path: str | None) -> None:
    """Generate or refine an experiment design."""
    run_design(brief, config_path=config_path)
```

## Layer 2: Command Logic (`cli/commands/{name}.py`)

**Purpose:** Implement command behavior, call services, and format output.

**What goes here:**
- Single `run_{name}()` function (the main entry point)
- Helper functions prefixed with `_` for internal use only
- Calls to `build_command_context()` to initialize services
- Service invocation and orchestration
- Result formatting and output via `click.echo()`
- Error handling with `click.ClickException()`

**What does NOT go here:**
- Click decorators (`@click.option()`, `@click.command()`, etc.)
- Click command group definitions
- Raw service initialization (use `build_command_context()` instead)

**Example (correct):**
```python
# cli/commands/design.py
from cli.services.copilot_session import CopilotSessionService, PERMISSIVE_TOOLSET
from .command_context import build_command_context

def run_design(brief: str | None, config_path: str | None = None) -> None:
    """Command entry point (called from main.py)."""
    context = build_command_context(
        config_path=config_path,
        required=False,
        model="gpt-5-mini",
        toolset=PERMISSIVE_TOOLSET,
        agent="edge-architect",
    )
    # ... implement business logic ...
    result = context.service.invoke(prompt)
    if result.stdout.strip():
        click.echo(result.stdout.strip())
```

## Layer 3: Shared Services (`cli/services/{name}.py`)

**Purpose:** Reusable, stateless utilities and external integrations.

**What goes here:**
- Classes and functions used by 2+ command modules
- External integrations (e.g., `CopilotSessionService`)
- Data loading and transformation (e.g., `load_project_config()`)
- Utility constants

**What does NOT go here:**
- Command-specific logic (belongs in `cli/commands/`)
- Click integration (belongs in `main.py`)
- One-off utilities used by a single command

**Example (correct):**
```python
# cli/services/copilot_session.py
@dataclass
class CopilotSessionService:
    """Reusable Copilot CLI session manager."""
    alias: str
    model: str
    toolset: Toolset | None = None
    
    def invoke(self, prompt: str) -> SessionResult:
        """Call Copilot CLI and return structured result."""
        # ...
```

## Shared Setup (`cli/commands/command_context.py`)

**Purpose:** Centralize common command initialization.

**Use this to:**
- Load project config with a single call
- Initialize services (Copilot session, etc.)
- Pass context to all commands uniformly

**Example (correct):**
```python
# In any command module
from .command_context import build_command_context

context = build_command_context(
    config_path=config_path,
    required=False,
    model="gpt-5-mini",
    toolset=PERMISSIVE_TOOLSET,
)
# context.project_config and context.service are ready to use
```

## Testing

**Command tests** belong in `tests/test_cli_{command}.py`:
- Use `CliRunner` from `click.testing`
- Invoke via `runner.invoke(cli, [...])` with the command path
- Mock services at their import paths (e.g., `cli.services.copilot_session.CopilotSessionService`)
- Use `runner.isolated_filesystem()` for file I/O isolation

**Service tests** belong in `tests/test_{service}.py`:
- Test service classes and functions in isolation
- Mock external calls (subprocess, file I/O, etc.)
- Verify state transitions and error handling

**Example (correct):**
```python
# tests/test_cli_design.py
from click.testing import CliRunner
from cli.main import cli
from unittest.mock import patch, MagicMock

def test_design_with_brief(tmp_path):
    """Design runs successfully when brief is provided."""
    runner = CliRunner()
    
    with runner.isolated_filesystem(temp_dir=tmp_path):
        with patch("cli.services.copilot_session.CopilotSessionService.send_message") as mock_send:
            mock_send.return_value = MagicMock(stdout="Experiment created.")
            result = runner.invoke(cli, ["autoresearch", "design", "--brief", "Test hypothesis"])
        
        assert result.exit_code == 0
        mock_send.assert_called_once()
```

## Anti-Patterns

| Anti-pattern | Why it fails | Fix |
|---|---|---|
| Click decorators in `cli/commands/` | Breaks import + testability | Move to `main.py` |
| Business logic in `main.py` | Hard to test; violates SoC | Move to `cli/commands/` |
| Direct config loading in command | Duplicated setup code; inconsistent context | Use `build_command_context()` |
| Duplicated service in `cli/commands/` | Violates DRY; diverges over time | Extract to `cli/services/` |
| Tight coupling between commands | Hard to test and refactor independently | Pass dependencies via `CommandContext` |
| Bare `subprocess.run()` in commands | No abstraction; hard to mock in tests | Wrap in `cli/services/` |

## Checklist: Adding a New Command

1. **Create** `cli/commands/{name}.py` with a single `run_{name}()` function.
2. **Import** the function in `cli/main.py`.
3. **Register** a Click command that calls `run_{name}()` with parsed arguments.
4. **Use** `build_command_context()` to initialize services (unless your command has no config or service needs).
5. **Test** via `tests/test_cli_{name}.py` using `CliRunner` to invoke `cli` with the command path; mock services at their import paths.
6. **Avoid** putting Click decorators or logic in the command module.

## Checklist: Adding a New Service

1. **Create** `cli/services/{name}.py` if the utility will be used by 2+ commands.
2. **Verify** the service is stateless or safe for reuse.
3. **Export** public symbols in `__all__`.
4. **Test** via `tests/test_{name}.py` by mocking external calls (subprocess, file I/O, etc.).
5. **Document** the service class and any required parameters in the docstring.
6. **Avoid** command-specific logic in services; keep them generic.

## Examples from the Codebase

### Command: `autoresearch design`
- **Routing:** `cli/main.py` defines `@autoresearch.command() def design(...)`
- **Logic:** `cli/commands/design.py` exports `run_design()`
- **Services:** Uses `CopilotSessionService` and `load_project_config()` via `build_command_context()`
- **Testing:** `tests/test_cli_design.py` uses `CliRunner` to invoke the CLI; mocks the service via `patch()`

### Command: `autoresearch experiment`
- **Routing:** `cli/main.py` defines `@experiment.command()` subcommands (create, start, finish, list, show)
- **Logic:** `cli/commands/experiment.py` exports `run_experiment_create()`, `run_experiment_start()`, etc.
- **Services:** Uses local registry (JSON file); no external Copilot service
- **Testing:** `tests/test_cli_experiment.py` uses `CliRunner` to invoke the CLI; mocks file I/O via `patch()`

---

**Last updated:** May 13, 2026  
**Scope:** CLI module organization and command placement  
**Applies to:** All changes under `cli/`, `tests/test_cli_*.py`, and `tests/test_*_cli.py`
