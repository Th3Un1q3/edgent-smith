# CLI KNOWLEDGE BASE (User Interface)

**OVERVIEW**: The primary user interface layer providing modular command-line tools via Click, managing configuration loading and experiment lifecycle operations.

## STRUCTURE
```text
cli/
├── main.py               # Command registration and routing hub (Click groups only)
├── commands/             # Module logic for specific CLI features (design, fix, init, etc.)
└── services/             # Stateless shared service layer for session & config management
```

## WHERE TO LOOK
- **Routing**: `cli/main.py` defines the command hierarchy and entry points (`autoresearch`, etc.).
- **Command Logic**: Implementation of specific operations (e.g., fixing, designing) resides in `cli/commands/*.py`.
- **Shared State/Logic**: Core services like `CopilotSession` or `ProjectConfig` are located in `cli/services/`.

## CONVENTIONS
- **Separation of Concerns**: Click decorators and command definitions belong strictly to `main.party`; all business logic must be implemented within the corresponding module in `commands/`.
- **Modular Routing**: Use the shared service layer (`services/`) for any logic required by multiple commands rather than duplicating code or passing heavy objects through CLI contexts directly.
- **Context Management**: Utilize a structured command context (e.g., `CommandContext`) to inject services into running commands.

## ANTI-PATTERNS (THIS DIRECTORY)
- Do not place business logic inside `cli/main.py`.
- Avoid duplicating shared service code across different modules in `commands/`.
- Never bypass the command context for accessing core system components like configuration or session state.