---
id: claims/edgent-smith-click-cli-dependency
type: claims
L0: "edgent-smith CLI uses Click >=8.1,<10 (pyproject.toml)"
confidence: 0.95
status: active
evidence: pyproject.toml
hotness: 0.7
ttl: 60d
freshness: 2026-10-24
provenance: pyproject.toml
---

# claims/edgent-smith-click-cli-dependency

Fact: edgent-smith declares click>=8.1,<10 as a runtime dependency in pyproject.toml [project] dependencies, and the CLI in cli/main.py is implemented with Click (click.group, click.option, click.argument).

Evidence: pyproject.toml [project] dependencies includes "click>=8.1,<10"; cli/main.py imports click and uses click.group/option/argument.

Confidence: 0.95. Status: active.
