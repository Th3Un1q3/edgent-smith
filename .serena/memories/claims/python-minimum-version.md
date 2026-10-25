---
id: claims/python-minimum-version
type: claims
L0: "edgent-smith requires Python >=3.13 per pyproject.toml requires-python"
confidence: 0.95
status: active
evidence: pyproject.toml
hotness: 0.7
ttl: 60d
freshness: 2026-10-24
provenance: pyproject.toml
---
# claims/python-minimum-version

Fact: edgent-smith requires Python >=3.13 (pyproject.toml requires-python >=3.13; ruff target-version py313).

Evidence: pyproject.toml [project] requires-python = ">=3.13"; [tool.ruff] target-version = "py313".

Confidence: 0.95. Status: active.
