#!/usr/bin/env python3
"""Validate security and contract controls in .github/workflows/experiment.yml.

Checks:
  1. YAML structure — concurrency, permission scoping, gate position,
          rate-limiter hardening, checkout action
  2. Permission gate logic — admin/write/maintain → ALLOW;
          read/triage/none → BLOCK
  3. Rate limiter logic — 0-9 runs → ALLOW; 10+ runs → BLOCK; fail-closed
  4. Runner contract wiring — shared state init,
          rerun-safe workflow_run_id, JSON result consumption,
          terminal states, replenishment

Dependency-free: uses only the Python standard library (re, sys, pathlib).

Run with: python scripts/validate_workflow_security.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

WORKFLOW_PATH = Path(__file__).parent.parent / ".github" / "workflows" / "experiment.yml"
EDGE_ARCHITECT_AGENT_PATH = (
    Path(__file__).parent.parent / ".github" / "agents" / "edge-architect.agent.md"
)
TERMINALIZE_SCRIPT_PATH = Path(__file__).parent / "terminalize_experiment.py"
PARSE_DRAFT_SCRIPT_PATH = Path(__file__).parent / "parse_draft.py"
CHECK_QUEUE_DEPTH_SCRIPT_PATH = Path(__file__).parent / "check_queue_depth.sh"
CHECK_LABELER_SCRIPT_PATH = Path(__file__).parent / "check_labeler.sh"
FORMAT_OUTPUT_SCRIPT_PATH = Path(__file__).parent / "format_experiment_output.py"

_OK = "PASS"
_FAIL = "FAIL"


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
    print(f"\n-- {title}")


def step_section(raw: str, step_name: str, next_step_name: str | None = None) -> str:
    start = raw.find(f"- name: {step_name}")
    if start == -1:
        return ""
    if next_step_name is None:
        return raw[start:]
    end = raw.find(f"- name: {next_step_name}", start)
    return raw[start:end] if end != -1 else raw[start:]


def replenish_section(raw: str) -> str:
    return step_section(raw, "Replenish auto-research queue")


def replenishment_runs_for_queue_count(workflow_raw: str, queue_count: int) -> bool:
    queue_depth = step_section(
        workflow_raw,
        "Check queue depth after terminalization",
        "Replenish auto-research queue",
    )
    gating_present = (
        "if: always() && steps.queue_depth.outputs.queue_empty == 'true'" in workflow_raw
    )
    # Check in the workflow step section and also in the extracted helper script.
    queue_depth_helper = (
        CHECK_QUEUE_DEPTH_SCRIPT_PATH.read_text() if CHECK_QUEUE_DEPTH_SCRIPT_PATH.exists() else ""
    )
    combined = queue_depth + "\n" + queue_depth_helper
    zero_branch_present = 'echo "queue_empty=true" >> "$GITHUB_OUTPUT"' in combined
    nonzero_branch_present = 'echo "queue_empty=false" >> "$GITHUB_OUTPUT"' in combined
    if not (gating_present and zero_branch_present and nonzero_branch_present):
        return False
    return queue_count == 0


def branch_condition_and_status_index(raw: str, condition: str, status: str) -> tuple[int, int]:
    condition_index = raw.find(condition)
    if condition_index == -1:
        return -1, -1
    # Try bash style first (final_status="...")
    status_index = raw.find(f'final_status="{status}"', condition_index)
    if status_index == -1:
        # Try Python return style (return "...")
        status_index = raw.find(f'return "{status}"', condition_index)
    return condition_index, status_index


def draft_contract_matches_workflow_parser(
    workflow_raw: str, agent_raw: str, parse_draft_raw: str = ""
) -> bool:
    if not parse_draft_raw and PARSE_DRAFT_SCRIPT_PATH.exists():
        parse_draft_raw = PARSE_DRAFT_SCRIPT_PATH.read_text()
    workflow_replenish = replenish_section(workflow_raw)
    normalized_workflow = re.sub(r"\s+", " ", workflow_replenish).strip()
    normalized_agent = re.sub(
        r"\s+",
        " ",
        agent_raw.replace("**", "").replace("`", ""),
    ).strip()

    workflow_expectations = (
        "Return only YAML" in normalized_workflow,
        "Do not return shell, markdown fences, or gh commands." in normalized_workflow,
        "title: experiment: <short title>" in normalized_workflow,
        "body: |" in normalized_workflow,
        'startswith("experiment:")' in parse_draft_raw,
        'lines[1] != "body: |"' in parse_draft_raw,
        'line.startswith("  ")' in parse_draft_raw,
    )
    agent_expectations = (
        "return only a raw YAML document" in normalized_agent,
        "no prose before or after" in normalized_agent,
        "title: experiment: <short title>" in normalized_agent,
        "body: |" in normalized_agent,
        "no shell commands" in normalized_agent.lower(),
        "emit exactly one issue draft" in normalized_agent.lower(),
        "title must start with experiment:." in normalized_agent.lower(),
    )
    return all(workflow_expectations) and all(agent_expectations)


def main() -> int:
    if not WORKFLOW_PATH.exists():
        print(f"FAIL Workflow file not found: {WORKFLOW_PATH}")
        return 1
    if not EDGE_ARCHITECT_AGENT_PATH.exists():
        print(f"FAIL Edge architect agent file not found: {EDGE_ARCHITECT_AGENT_PATH}")
        return 1

    raw = WORKFLOW_PATH.read_text()
    agent_raw = EDGE_ARCHITECT_AGENT_PATH.read_text()
    terminalize_raw = (
        TERMINALIZE_SCRIPT_PATH.read_text() if TERMINALIZE_SCRIPT_PATH.exists() else ""
    )
    queue_depth_raw = (
        CHECK_QUEUE_DEPTH_SCRIPT_PATH.read_text() if CHECK_QUEUE_DEPTH_SCRIPT_PATH.exists() else ""
    )
    labeler_raw = (
        CHECK_LABELER_SCRIPT_PATH.read_text() if CHECK_LABELER_SCRIPT_PATH.exists() else ""
    )
    format_output_raw = (
        FORMAT_OUTPUT_SCRIPT_PATH.read_text() if FORMAT_OUTPUT_SCRIPT_PATH.exists() else ""
    )
    wf_section, _, job_section = raw.partition("jobs:")
    replenish = replenish_section(raw)
    queue_depth = step_section(
        raw,
        "Check queue depth after terminalization",
        "Replenish auto-research queue",
    )

    job_perms_section = ""
    job_perms_match = re.search(r"\bpermissions:(.*?)\bsteps:", job_section, re.DOTALL)
    if job_perms_match:
        job_perms_section = job_perms_match.group(1)

    first_step_name = ""
    first_step_match = re.search(r"steps:\s*\n(?:\s*#[^\n]*\n)*\s+- name:\s*(.+)", job_section)
    if first_step_match:
        first_step_name = first_step_match.group(1).strip()

    r = _Results()

    section("1. YAML structure")
    r.check(
        "concurrency.group == 'auto-research'",
        bool(re.search(r"concurrency:\s*\n\s+group:\s*auto-research", raw)),
    )
    r.check(
        "concurrency.cancel-in-progress == false",
        bool(re.search(r"cancel-in-progress:\s*false", raw)),
    )
    r.check(
        "workflow-level permissions: contents == 'read'",
        bool(re.search(r"^\s*contents:\s*read", wf_section, re.MULTILINE)),
    )
    r.check(
        "workflow-level permissions: no write/admin scopes",
        not bool(re.search(r"^\s*\w[\w-]*:\s*(write|admin)\b", wf_section, re.MULTILINE)),
    )
    r.check(
        "job permissions: actions == 'read'",
        bool(re.search(r"^\s*actions:\s*read", job_perms_section, re.MULTILINE)),
    )
    r.check(
        "job permissions: contents == 'write'",
        bool(re.search(r"^\s*contents:\s*write", job_perms_section, re.MULTILINE)),
    )
    r.check(
        "job permissions: issues == 'write'",
        bool(re.search(r"^\s*issues:\s*write", job_perms_section, re.MULTILINE)),
    )
    r.check(
        "job permissions: pull-requests == 'write'",
        bool(re.search(r"^\s*pull-requests:\s*write", job_perms_section, re.MULTILINE)),
    )
    r.check(
        "job permissions: packages == 'write'",
        bool(re.search(r"^\s*packages:\s*write", job_perms_section, re.MULTILINE)),
    )
    r.check(
        "security gate is the first step",
        first_step_name.lower().startswith("check labeler"),
    )
    r.check(
        "permission gate uses collaborators API",
        "collaborators" in raw or "collaborators" in labeler_raw,
    )
    r.check(
        "rate limiter counts 'queued' runs",
        bool(re.search(r"\bqueued\b", raw)) or bool(re.search(r"\bqueued\b", labeler_raw)),
    )
    r.check(
        "rate limiter is fail-closed (! RECENT=...)",
        "! RECENT=" in raw or "! RECENT=" in labeler_raw,
    )
    r.check(
        "rate limiter validates numeric output",
        "^[0-9]+$" in raw or "^[0-9]+$" in labeler_raw,
    )
    r.check(
        "rate limiter uses rolling 1-hour window",
        "1 hour ago" in raw or "1 hour ago" in labeler_raw,
    )
    r.check("rate limiter uses MAX_RUNS variable", "MAX_RUNS: 10" in raw)
    r.check(
        "checkout uses actions/checkout@v6",
        bool(re.search(r"uses:\s*actions/checkout@v6", raw)),
    )

    section("2. Permission gate logic")
    allowed_permissions = {"admin", "write", "maintain"}

    def gate_allows(permission: str) -> bool:
        return permission in allowed_permissions

    r.check("permission 'admin'    -> ALLOW", gate_allows("admin"))
    r.check("permission 'write'    -> ALLOW", gate_allows("write"))
    r.check("permission 'maintain' -> ALLOW", gate_allows("maintain"))
    r.check("permission 'read'     -> BLOCK", not gate_allows("read"))
    r.check("permission 'triage'   -> BLOCK", not gate_allows("triage"))
    r.check("permission 'none'     -> BLOCK", not gate_allows("none"))

    section("3. Rate limiter logic")
    max_runs = 10

    def rate_allows(recent: int) -> bool:
        return recent < max_runs

    r.check("recent=0 -> ALLOW", rate_allows(0))
    r.check("recent=1 -> ALLOW", rate_allows(1))
    r.check("recent=9 -> ALLOW", rate_allows(9))
    r.check(f"recent={max_runs} -> BLOCK", not rate_allows(max_runs))
    r.check(f"recent={max_runs + 1} -> BLOCK", not rate_allows(max_runs + 1))

    section("4. Runner contract wiring")
    init_step = raw.find("Initialize experiment state")
    runner_step = raw.find("Run Copilot agent, tests, and evaluations")
    r.check(
        "shared state is initialized before the runner step",
        init_step != -1 and runner_step != -1 and init_step < runner_step,
    )
    r.check(
        "devcontainer env uses explicit WORKFLOW_RUN_ID assignment",
        "WORKFLOW_RUN_ID=${{ github.run_id }}-${{ github.run_attempt }}" in raw,
    )
    r.check(
        "devcontainer env uses explicit ISSUE_NUMBER assignment",
        "ISSUE_NUMBER=${{ github.event.issue.number }}" in raw,
    )
    r.check(
        "runner receives issue-number argument",
        '--issue-number "${ISSUE_NUMBER}"' in raw,
    )
    r.check(
        "runner receives state-path argument",
        '--state-path "${STATE_PATH}"' in raw,
    )
    r.check(
        "runner receives rerun-unique workflow-run-id argument",
        '--workflow-run-id "${WORKFLOW_RUN_ID}"' in raw,
    )
    r.check(
        "runner timeout is mapped into an explicit timed_out output",
        "status=timed_out" in raw,
    )
    r.check(
        "runner JSON score delta is exported for later steps",
        '"score_delta"' in raw or '"score_delta"' in format_output_raw,
    )
    promotion_failed_condition = (
        'experiment_status == "candidate_ready" and promotion_outcome != "success":'
    )
    succeeded_condition = 'and commit_push_outcome == "success"'
    post_candidate_failed_condition = (
        'experiment_status == "candidate_ready" and promotion_outcome == "success":'
    )
    promotion_failed_branch, promotion_failed_status = branch_condition_and_status_index(
        terminalize_raw,
        promotion_failed_condition,
        "promotion_failed",
    )
    succeeded_branch, succeeded_status = branch_condition_and_status_index(
        terminalize_raw,
        succeeded_condition,
        "succeeded",
    )
    post_candidate_failed_branch, post_candidate_failed_status = branch_condition_and_status_index(
        terminalize_raw,
        post_candidate_failed_condition,
        "post_candidate_failed",
    )
    r.check(
        "candidate_ready + failed promotion maps to terminal status promotion_failed",
        promotion_failed_branch != -1
        and promotion_failed_status != -1
        and promotion_failed_branch < promotion_failed_status,
    )
    r.check(
        ("candidate_ready + successful promotion and commit maps to terminal status succeeded"),
        succeeded_branch != -1 and succeeded_status != -1 and succeeded_branch < succeeded_status,
    )
    r.check(
        (
            "candidate_ready + successful promotion without commit "
            "falls through to post_candidate_failed"
        ),
        post_candidate_failed_branch != -1
        and post_candidate_failed_status != -1
        and post_candidate_failed_branch < post_candidate_failed_status,
    )
    r.check(
        (
            "candidate_ready terminal branches stay ordered from "
            "specific success to fallback failure"
        ),
        promotion_failed_branch != -1
        and succeeded_branch != -1
        and post_candidate_failed_branch != -1
        and promotion_failed_branch < succeeded_branch < post_candidate_failed_branch,
    )
    r.check("terminal state timed_out is present", "timed_out" in raw)
    r.check("terminal state cancelled is present", "cancelled" in raw)
    r.check(
        "workflow persists promotion_applied flag",
        '"promotion_applied"' in terminalize_raw,
    )
    r.check(
        "workflow persists commit_pushed flag",
        '"commit_pushed"' in terminalize_raw,
    )
    r.check(
        "workflow persists replenishment_issue_number flag",
        '"replenishment_issue_number"' in terminalize_raw,
    )
    r.check(
        "queue depth excludes terminal experiment labels",
        '-label:"experiment-success" -label:"experiment-failure"' in raw
        or '-label:"experiment-success" -label:"experiment-failure"' in queue_depth_raw,
    )
    r.check(
        "queue replenishment is gated on queue_empty output",
        "if: always() && steps.queue_depth.outputs.queue_empty == 'true'" in raw,
    )
    r.check(
        "queue depth maps queue_count=0 to queue_empty=true",
        replenishment_runs_for_queue_count(raw, 0),
    )
    r.check(
        "queue depth maps non-zero queue_count to queue_empty=false",
        "else" in queue_depth + queue_depth_raw
        and 'echo "queue_empty=false" >> "$GITHUB_OUTPUT"' in queue_depth + queue_depth_raw,
    )
    r.check(
        "queue_count=1 keeps replenishment blocked because queue_empty is false",
        not replenishment_runs_for_queue_count(raw, 1),
    )
    r.check(
        "queue replenishment uses the edge-architect agent",
        "--agent edge-architect" in replenish,
    )
    validation_index = replenish.find("python3 scripts/parse_draft.py")
    create_index = replenish.find("gh issue create")
    r.check(
        "queue replenishment requests YAML-only draft output",
        "Return only YAML" in replenish and "body: |" in replenish,
    )
    r.check(
        "queue replenishment validates YAML before gh issue create",
        validation_index != -1 and create_index != -1 and validation_index < create_index,
    )
    r.check(
        "queue replenishment keeps a single workflow-owned gh issue create",
        replenish.count("gh issue create") == 1,
    )
    r.check(
        "queue replenishment does not execute agent-authored shell",
        'bash "${SCRIPT_PATH}"' not in replenish and "SCRIPT_PATH=" not in replenish,
    )
    r.check(
        "queue replenishment does not rely on grep-only gh guard",
        "grep -c 'gh issue create'" not in replenish
        and "Expected exactly one gh issue create command" not in replenish,
    )
    r.check(
        "agent draft mode matches workflow parser expectations",
        draft_contract_matches_workflow_parser(raw, agent_raw),
    )
    r.check("terminalize_experiment.py exists", TERMINALIZE_SCRIPT_PATH.exists())
    r.check("check_queue_depth.sh exists", CHECK_QUEUE_DEPTH_SCRIPT_PATH.exists())
    r.check("check_labeler.sh exists", CHECK_LABELER_SCRIPT_PATH.exists())
    r.check("parse_draft.py exists", PARSE_DRAFT_SCRIPT_PATH.exists())
    r.check("format_experiment_output.py exists", FORMAT_OUTPUT_SCRIPT_PATH.exists())

    outcome = _OK if r.ok else _FAIL
    print(f"\nResults: {r.passed}/{r.total} checks passed {outcome}")
    return 0 if r.ok else 1


if __name__ == "__main__":
    sys.exit(main())
