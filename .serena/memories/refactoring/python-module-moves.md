# Python Module Moves Between Layers

Pattern for relocating a Python module across layers (e.g. `cli/` -> `cli/services/`) without a big-bang cutover.

## Pattern

1. **Move the implementation** to the target layer.
2. **Keep a re-export shim** at the old path so existing imports keep working during the transition:
   ```python
   from cli.services.project_config import *  # noqa: F403
   ```
3. **Pin the target location with a dedicated guard test** that asserts three things:
   - the module imports and works at the new path;
   - the shim re-exports the *same objects*, not copies (`legacy.load_project_config is services.load_project_config`);
   - real consumers resolve to the new module (`command_context.load_project_config.__module__ == "cli.services.project_config"`).

## Why the guard test matters

Without it the move regresses silently: someone re-adds an implementation at the old path, or a consumer keeps importing the shim, and the layering intent is lost with nothing failing.

The consumer assertion is the **deletion trigger** for the shim — once no consumer resolves through the old path, delete the shim and its shim-specific test together.

## Tradeoff

The `import *` shim needs a `# noqa: F403` suppression. Accept that only for a shim with a scheduled deletion; a shim meant to stay should list its re-exports explicitly.

## Example in this repo

- implementation: `cli/services/project_config.py`
- shim: `cli/project_config.py`
- guard test: `tests/test_project_config_module_location.py`