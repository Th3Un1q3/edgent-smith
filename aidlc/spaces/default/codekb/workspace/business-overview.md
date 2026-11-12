# Business Overview

## Purpose

`edgent-smith` is a working system for making small ("edge") language models measurably better at agentic tasks without a human hand-running every experiment. It pairs a deliberately small pydantic-ai agent with an evaluation runner and an issue-driven loop that lets an AI coding agent propose an edit, score it, and promote the result only when the score strictly improves.

The repository is also a harness-engineering laboratory: it runs the same project across four control planes (OpenCode, DeepSeek Harness, GitHub Copilot agents, Conductor) and a DevContainer-first CI, and it records what each plane can and cannot do.

## Business Domain

| Dimension | Position |
|---|---|
| Domain | AI agent engineering — edge/on-device model evaluation and harness construction |
| Operating model | Single repository, single maintainer-scale team; research and tooling, not a revenue system |
| Consumers | The maintainer, CI, and the coding agents that act on the repository |
| Outputs | Promoted baselines, experiment state history, published skills, harness configuration |

## Key Capabilities

1. **Edge agent execution** — one pydantic-ai agent with three inline tools and a typed `AgentOutput` (`agents/edge.py`).
2. **Model evaluation against baselines** — a unified runner scores datasets with Ollama, GitHub Copilot, or OpenRouter backends and compares against per-baseline JSON thresholds (`evals/runner.py`, root `*.baseline.json`).
3. **Issue-driven experimentation** — an issue labelled `auto-research` triggers a DevContainer workflow that edits the agent, scores it, and promotes only a strict improvement (`.github/workflows/experiment.yml`, `scripts/experiment.py`).
4. **Local autofix loop** — a config-driven hook list runs `format`, `lint`, `typecheck`, and `test`, then hands failures to a Copilot session for remediation (`cli/commands/fix.py`, `autofix.toml`).
5. **Two evaluation families kept separate** — skill evals ask whether a skill's guidance changes agent behaviour; edge-agent evals ask how a model scores on a dataset (`evals/AGENTS.md`).
6. **Harness plugins with enforced quality gates** — OpenCode v2 plugins inject instructions, keep an agent on a declared goal, cap tool calls, and run project gates when files change (`.opencode/plugins/`).
7. **Fail-closed quality policy** — thresholds, lint rules, and anti-escape checks are pinned by `scripts/verify_thresholds.sh` as CI gate 0.

## Actors and Their Goals

| Actor | Goal |
|---|---|
| Maintainer | Change the agent or harness, trust the gates, keep the experiment record |
| Edge architect agent | Design the next experiment and replenish the issue queue |
| Implement agent | Edit `agents/edge.py` to satisfy one experiment hypothesis |
| CI | Prove formatting, lint, types, tests, workflow security, and mutation score hold |
| Skill author | Publish reusable guidance under `.agents/skills/` and prove it changes behaviour |

## Business Rules

- **Strict-improvement-only promotion.** A candidate baseline replaces the current one only when its score is strictly higher; `just baseline-status` is diagnostic and promotes nothing (`README.md:235-238`).
- **Separate state owners.** CLI experiment storage (`experiments/index.json`, `experiments/experiments/<id>/`) and script-runner state (`experiments/<issue>.state.json`) are kept apart on purpose (`README.md:153-177`).
- **Skill evals and edge-agent evals are never mixed.** A skill eval measures guidance; an edge-agent eval measures a model.
- **Gates may not be weakened to pass.** Lowering a threshold, replacing a pinned number, or downgrading an error to `warn` is forbidden, and any threshold change needs a written before/after measurement (`scripts/verify_thresholds.sh`, `.opencode/instructions/threshold-policy.instructions.md`).
- **Committing is gated on `just verify-agents` printing `── verify-agents: PASS ──`.**
- **No silent deploy.** CI defines only `prebuild-devcontainer` and `ci`; there is no deploy job.

## Vocabulary

| Term | Meaning |
|---|---|
| Edge agent | The pydantic-ai runtime agent in `agents/edge.py` |
| Baseline | A per-model minimum pass-rate file (`*.baseline.json`) an experiment must beat |
| Candidate | A scored run written alongside the baseline for review or promotion |
| Harness | A control plane that loads and constrains agent behaviour (OpenCode, DSH, Copilot, Conductor) |
| RUG | A reusable agent workflow pattern; always qualified by harness |
| System A / System B | Harness-free runtime (`agents/`, `config.py`) vs harness-native configuration (`.dsh/`) |
| Quality gate | A configured command the OpenCode plugin runs when a matching file changes |
| Synthetic message | A message appended to a session by a plugin without starting a model turn |
| Skill | A capability package under `.agents/skills/<name>/` loaded on demand |

## Success Measures

- A promoted baseline is reproducibly better than the previous one on the same dataset and provider.
- `just ci` passes with all 13 gates executed or explicitly skipped by an invocation flag.
- A quality-gate signal reaches the agent as a synthetic message that the agent can read without the harness treating it as a human turn.
- A change to the plugins leaves coverage at or above 90% and the mutation score at or above the 72 break threshold.
