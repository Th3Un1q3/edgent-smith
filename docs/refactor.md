# Auto-Research Command Review Log

Purpose: working review log for the user-requested review of the public `just autoresearch *` command set.

## Scope and assumptions

- Includes public `just autoresearch *` commands and the user-facing `just fix` shortcut.
- Reviews three layers: `just` entrypoints, Click command tree, and shared support modules and artifacts.
- Includes adjacent command-owned assets that shape user-visible behavior for design, fix, and experiment flows.
- Excludes eval internals, model wiring, and broader runtime architecture.

## Best-practice references to consult

- Click documentation
- just manual
- GitHub Copilot CLI documentation and release notes
- Secondary browser-based CLI UX guidance

## Findings

### Ownership and topology

#### High: Public command ownership is split across three user-facing layers
- Severity: High
- Statement: The public autoresearch surface is split across `just` recipes, the Click `autoresearch` tree, and the argparse-backed experiment runner, but the ownership boundary is only partially described in repo docs.
- Evidence: [justfile](../justfile#L61-L91), [cli/main.py](../cli/main.py#L28-L105), [scripts/experiment.py](../scripts/experiment.py#L838-L930), [README.md](../README.md#L93-L117)
- Rationale: Users have to infer which layer owns registry CRUD, design submission, execution, promotion, and the local loop. That makes discovery harder and raises the cost of later atomic refactors because the boundary is real in code but weakly named in docs.
- Suggested refactor direction: Document the command map in one place first, then choose whether to keep the split explicit or collapse more of the runner surface under one root command tree.

#### Medium: `autoresearch experiment` owns registry CRUD, not runnable experiment execution
- Severity: Medium
- Statement: The Click `autoresearch experiment` group manages local registry records, while run execution, baseline promotion, and the local loop remain separate script-backed entrypoints.
- Evidence: [cli/main.py](../cli/main.py#L90-L160), [cli/commands/experiment.py](../cli/commands/experiment.py#L10-L55), [justfile](../justfile#L61-L79), [scripts/experiment.py](../scripts/experiment.py#L860-L930)
- Rationale: The shared `experiment` noun spans two different ownership domains. That is workable, but it is easy to misread `autoresearch experiment` as the full experiment workflow rather than registry-only lifecycle management.
- Suggested refactor direction: Tighten naming around registry vs runner responsibilities, or move more runner commands under the same noun if the intent is a single experiment surface.

#### Low: Compatibility aliases and wrappers expand the public surface area
- Severity: Low
- Statement: The repo still exposes compatibility entrypoints at multiple layers, including `just experiment-loop`, shell-based `scripts/fix_code.sh`, and runner model flag aliases.
- Evidence: [justfile](../justfile#L75-L79), [scripts/fix_code.sh](../scripts/fix_code.sh#L1-L10), [scripts/experiment.py](../scripts/experiment.py#L838-L930)
- Rationale: These aliases preserve callers, but they also enlarge the supported surface and increase the number of locations that must stay in sync during future CLI cleanup.
- Suggested refactor direction: Keep compatibility shims explicit, document which ones are legacy, and retire them one by one once callers are confirmed gone.

### Interface consistency

#### High: Config selection is inconsistent and partly hidden
- Severity: High
- Statement: `design` and `fix` expose `--config`, `validate` does not, and the shared loader silently picks the lexicographically first `*.config.toml` when no explicit path is provided.
- Evidence: [cli/main.py](../cli/main.py#L43-L89), [cli/commands/validate.py](../cli/commands/validate.py#L10-L18), [cli/project_config.py](../cli/project_config.py#L37-L79)
- Rationale: Config targeting becomes ambiguous as soon as a directory has more than one project config. The current help surface does not tell users that `validate` depends on auto-discovery or that auto-discovery is lexicographic rather than semantic.
- Suggested refactor direction: Expose explicit config selection consistently across config-backed commands, then either document or replace the lexicographic fallback with a clearer rule.

#### Medium: Adjacent commands use different input shapes without a visible rule
- Severity: Medium
- Statement: `init` requires `--name`, `design` uses an optional positional brief, `experiment create` requires named options, and other experiment lifecycle commands use positional IDs.
- Evidence: [cli/main.py](../cli/main.py#L32-L160)
- Rationale: Each choice is defensible locally, but together they make the command family harder to predict. That increases help lookups for routine use and raises the chance of command-shape drift during incremental additions.
- Suggested refactor direction: Define a narrow contract for each command family, then normalize new and touched commands toward that contract instead of mixing positional and option-heavy styles ad hoc.

### Duplication and shared logic

#### Medium: Copilot tool-policy construction is duplicated across CLI layers
- Severity: Medium
- Statement: The permissive Copilot tool policy is defined once in the shared session service and again in the experiment runner command builder with the same deny list.
- Evidence: [cli/services/copilot_session.py](../cli/services/copilot_session.py#L23-L31), [scripts/experiment.py](../scripts/experiment.py#L460-L487)
- Rationale: The current policies match closely, but future changes to allowed or denied tools can drift between the Click-backed flows and the script-backed runner because they are maintained in separate implementations.
- Suggested refactor direction: Move the shared Copilot invocation policy into one reusable helper and have both layers build on that single source.

#### Medium: Config loading and session setup are only partially centralized
- Severity: Medium
- Statement: Commands reuse `load_project_config`, but alias fallback, model selection, agent selection, and session setup still repeat in each command implementation.
- Evidence: [cli/project_config.py](../cli/project_config.py#L37-L79), [cli/commands/design.py](../cli/commands/design.py#L13-L30), [cli/commands/fix.py](../cli/commands/fix.py#L30-L53), [cli/commands/validate.py](../cli/commands/validate.py#L10-L21)
- Rationale: The current duplication is small, but it already produces different defaults and different affordances across adjacent commands. That is the kind of repetition that tends to spread when new CLI commands are added.
- Suggested refactor direction: Extract a small command-context helper for config resolution and session construction, then adopt it only in touched commands.

### Documentation accuracy

#### High: `just` is the canonical interface, but the full `autoresearch` surface is not documented
- Severity: High
- Statement: Contributor instructions declare `just` as the supported command interface, but the justfile comments and README do not describe the full `just autoresearch` surface; they mainly document `just fix` and the script-backed experiment runner.
- Evidence: [.github/copilot-instructions.md](../.github/copilot-instructions.md#L168-L198), [justfile](../justfile#L87-L91), [README.md](../README.md#L93-L117), [README.md](../README.md#L176-L214), [cli/main.py](../cli/main.py#L28-L160)
- Rationale: This is the main instruction-level gap. Users are told to use `just`, but the documented `just` surface is incomplete, so discovery still requires reading Click help or source.
- Suggested refactor direction: Add one terse command-map section that enumerates `just autoresearch init|validate|design|fix|experiment ...` and explicitly separates it from `run-experiment*` and `promote-baseline`.

#### Medium: README documents per-issue runner state and autofix, but not the registry/state boundary used by design
- Severity: Medium
- Statement: README explains per-issue and manual runner state files, but it does not document the local experiment registry file or the fact that `design` reads registry context rather than the runner state files.
- Evidence: [README.md](../README.md#L85-L117), [cli/commands/design.py](../cli/commands/design.py#L13-L35), [cli/commands/experiment.py](../cli/commands/experiment.py#L10-L38)
- Rationale: The code has a clear distinction between registry-backed design context and runner-owned attempt state, but the docs flatten that distinction. That makes state ownership harder to understand when debugging or planning follow-up CLI cleanup.
- Suggested refactor direction: Document the registry file and its relationship to design separately from runner state, without changing the storage model yet.

#### Medium: `init` still prints stale Copilot CLI installation guidance
- Severity: Medium
- Statement: The fallback installation message in `init` still tells users to install `@github/copilot-cli`, which no longer matches the current GitHub Copilot CLI packaging documented upstream.
- Evidence: [cli/commands/init.py](../cli/commands/init.py#L33-L49), [plan/20260512-autoresearch-command-review/research_findings_instruction_level_documentation_and_external_tool_guidance.yaml](plan/20260512-autoresearch-command-review/research_findings_instruction_level_documentation_and_external_tool_guidance.yaml)
- Rationale: This is concrete documentation drift inside a user-facing command path. It increases setup friction exactly where `init` is supposed to validate and guide first-time CLI usage.
- Suggested refactor direction: Update the install guidance to the current package name and keep external-tool installation strings centralized so future packaging changes land once.