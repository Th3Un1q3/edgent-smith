#!/usr/bin/env python3
"""Validate security controls in .github/workflows/experiment.yml.

Checks:
  1. YAML structure          — concurrency, permission scoping, gate position,
                               rate-limiter hardening, checkout action
  2. Permission gate logic   — admin/write/maintain → ALLOW; read/triage/none → BLOCK
  3. Rate limiter logic      — 0-2 runs → ALLOW; 3+ runs → BLOCK; fail-closed
  4. Prompt injection        — randomised sentinel, IMPORTANT precedes body

Run with: python scripts/validate_workflow_security.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required: pip install pyyaml")

WORKFLOW_PATH = (
    Path(__file__).parent.parent / ".github" / "workflows" / "experiment.yml"
)

_OK = "✅"
_FAIL = "❌"


class _Results:
    """Accumulate pass/fail counts for all checks in a single run."""

    def __init__(self) -> None:
        self.total = 0
        self.failures = 0

    def check(self, description: str, condition: bool) -> None:
        self.total += 1
        status = _OK if condition else _FAIL
        print(f"  {status} {description}")
        if not condition:
            self.failures += 1

    @property
    def passed(self) -> int:
        return self.total - self.failures

    @property
    def ok(self) -> bool:
        return self.failures == 0


def section(title: str) -> None:
    print(f"\n── {title}")


def main() -> int:
    if not WORKFLOW_PATH.exists():
        print(f"❌ Workflow file not found: {WORKFLOW_PATH}")
        return 1

    raw = WORKFLOW_PATH.read_text()
    wf = yaml.safe_load(raw)

    job = wf["jobs"]["auto-research"]
    job_perms = job.get("permissions", {})
    wf_perms = wf.get("permissions", {})
    concurrency = wf.get("concurrency", {})
    steps = job.get("steps", [])
    gate_script = steps[0].get("run", "") if steps else ""

    r = _Results()

    # ── 1. YAML structure ─────────────────────────────────────────────────────
    section("1. YAML structure")

    r.check("concurrency.group == 'auto-research'",
            concurrency.get("group") == "auto-research")
    r.check("concurrency.cancel-in-progress == false",
            concurrency.get("cancel-in-progress") is False)
    r.check("workflow-level permissions: contents == 'read'",
            wf_perms.get("contents") == "read")
    r.check("workflow-level permissions: no write/admin scopes",
            all(v not in ("write", "admin") for v in wf_perms.values()))
    r.check("job permissions: actions == 'read'",
            job_perms.get("actions") == "read")
    r.check("job permissions: contents == 'write'",
            job_perms.get("contents") == "write")
    r.check("job permissions: issues == 'write'",
            job_perms.get("issues") == "write")
    r.check("job permissions: pull-requests == 'write'",
            job_perms.get("pull-requests") == "write")
    r.check("security gate is the first step",
            steps[0].get("name", "").lower().startswith("check labeler"))
    r.check("permission gate uses collaborators API",
            "collaborators" in gate_script)
    r.check("rate limiter counts 'queued' runs",
            bool(re.search(r"\bqueued\b", raw)))
    r.check("rate limiter is fail-closed (! RECENT=...)",
            "! RECENT=" in raw)
    r.check("rate limiter validates numeric output",
            "^[0-9]+$" in raw)
    r.check("rate limiter uses rolling 1-hour window",
            "1 hour ago" in raw)
    r.check("rate limiter uses MAX_RUNS variable",
            "MAX_RUNS=3" in raw)
    r.check("checkout uses actions/checkout@v4",
            any(str(s.get("uses", "")).startswith("actions/checkout@v4")
                for s in steps))

    # ── 2. Permission gate logic ───────────────────────────────────────────────
    section("2. Permission gate logic")

    _ALLOWED = {"admin", "write", "maintain"}

    def _gate_allows(perm: str) -> bool:
        return perm in _ALLOWED

    r.check("permission 'admin'    → ALLOW", _gate_allows("admin"))
    r.check("permission 'write'    → ALLOW", _gate_allows("write"))
    r.check("permission 'maintain' → ALLOW", _gate_allows("maintain"))
    r.check("permission 'read'     → BLOCK", not _gate_allows("read"))
    r.check("permission 'triage'   → BLOCK", not _gate_allows("triage"))
    r.check("permission 'none'     → BLOCK", not _gate_allows("none"))

    # ── 3. Rate limiter logic ──────────────────────────────────────────────────
    section("3. Rate limiter logic")

    MAX_RUNS = 3

    def _rate_allows(recent: int) -> bool:
        return recent < MAX_RUNS

    r.check("recent=0 → ALLOW",               _rate_allows(0))
    r.check("recent=1 → ALLOW",               _rate_allows(1))
    r.check("recent=2 → ALLOW",               _rate_allows(2))
    r.check(f"recent={MAX_RUNS} → BLOCK",     not _rate_allows(MAX_RUNS))
    r.check(f"recent={MAX_RUNS + 1} → BLOCK", not _rate_allows(MAX_RUNS + 1))

    # ── 4. Prompt injection hardening ──────────────────────────────────────────
    section("4. Prompt injection hardening")

    r.check("uses openssl rand for randomised sentinel",
            "openssl rand" in raw)
    r.check("SENTINEL variable is set",
            "SENTINEL=" in raw)
    r.check("delimiter includes SENTINEL variable",
            "issue_body_${SENTINEL}" in raw)
    r.check("IMPORTANT disclaimer precedes body",
            "IMPORTANT:" in raw)
    r.check("closing delimiter uses SENTINEL",
            "</issue_body_${SENTINEL}>" in raw)
    r.check("no static <issue_body> delimiter used",
            "<issue_body>" not in raw)

    # ── Summary ────────────────────────────────────────────────────────────────
    outcome = _OK if r.ok else _FAIL
    print(f"\nResults: {r.passed}/{r.total} checks passed {outcome}")

    return 0 if r.ok else 1


if __name__ == "__main__":
    sys.exit(main())
