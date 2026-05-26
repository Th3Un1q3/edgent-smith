---
name: hf-cli-papers
description: "Use when you need to discover, triage, and extract high-signal research from Hugging Face using the hf CLI, especially hf papers ls, search, info, and read."
argument-hint: "Describe your topic, time window, and desired output format"
---

# HF CLI Papers Workflow

Use this skill to run a repeatable paper-research funnel with the Hugging Face CLI.
It prioritizes speed, relevance, and evidence quality over reading many papers end-to-end.

## Outcome

Produce a short, high-signal paper brief with:
- A bounded shortlist of candidate papers.
- Structured metadata for each retained paper.
- Deep reads only for papers that survive triage.
- Final recommendations tied to the user goal.

## When to Use

Use this skill when:
- You need recent papers for a specific technical topic.
- You want to avoid noisy, open-ended browsing.
- You need reproducible CLI steps that can be rerun later.
- You want machine-readable output for scripting.

Do not use this skill when:
- The user only wants a single known paper ID looked up.
- No Hugging Face CLI is available and command execution is not possible.

## Procedure

1. Verify CLI availability and command surface first.

```bash
hf --help
hf papers --help
```

Decision point:
- If either command fails, report the exact blocker and stop.
- If both commands work, continue.

2. Set a bounded search frame before querying.

Define:
- Topic statement: one sentence.
- Time scope: current month plus previous month by default.
- Retrieval cap: usually 5 to 20 items per query.

3. Build the initial candidate pool.

```bash
# Human-readable quick scan
hf papers ls --sort=trending --limit=20

# Time-scoped pull (examples)
hf papers ls --month=YYYY-MM --limit=20
hf papers ls --week=YYYY-Www --limit=20

# Topic pull
hf papers search "<topic keywords>" --limit=20
```

Optional for automation:

```bash
hf papers ls --sort=trending --limit=20 --format=json
hf papers search "<topic keywords>" --limit=20 --format=json
```

Decision point:
- If results are too broad, tighten keywords or add constraints.
- If results are too narrow, expand keywords and include one broader synonym query.

4. Triage to a shortlist.

Retain papers that satisfy most of these:
- Direct relevance to the topic.
- Concrete mechanism (not only trend framing).
- Practical transfer potential.
- Recency or clearly superior older signal.

Target shortlist size:
- 3 to 8 papers.

5. Enrich each shortlisted paper with structured metadata.

```bash
hf papers info <paper-id>
# Optional explicit mode for scripts
hf papers info <paper-id> --format=json
```

Capture for each:
- Paper ID and title.
- Date or recency context.
- Core mechanism in one line.
- Why it matters for the user goal.

6. Read full markdown only for the final evidence-driving subset.

```bash
hf papers read <paper-id>
```

Decision point:
- If the abstract and metadata already settle fit, do not deep-read.
- If mechanism details are needed to justify recommendations, deep-read.

7. Produce concise output.

Use this shape:
- Final shortlist table: id, title, relevance score, keep/drop note.
- Two to five key insights mapped to the user goal.
- Explicit trade-offs or risks.
- Suggested next actions (optional).

## Optimization Playbook

Use this section when you need better retrieval quality than a single search pass.

### 1. Precision Modes

Choose one mode before running searches:

- Precision mode: narrow keyword phrase plus strict time scope. Use when false positives are expensive.
- Balanced mode: one narrow query plus one broader synonym query. Use for most research tasks.
- Exploration mode: broad query family and larger retrieval cap. Use when novelty and coverage matter more than exact match.

Example query pack (balanced):

```bash
hf papers search "edge agent routing" --limit=20 --format=json
hf papers search "adaptive model selection" --limit=20 --format=json
hf papers search "lightweight agent inference" --limit=20 --format=json
```

### 2. Improve Relevance With Intent Axes

Split your query intent across axes instead of one overloaded query:

- Problem axis: what issue to solve.
- Mechanism axis: how it is solved.
- Constraint axis: resource or deployment limits.

Example:
- Problem: `agent reliability`
- Mechanism: `self-evolving skills` or `policy optimization`
- Constraint: `edge` or `on-device`

Run 1 to 2 searches per axis, then merge and rerank.

### 3. Use Time Controls Aggressively

For recency-sensitive tasks, pull from multiple windows and merge:

```bash
hf papers ls --month=YYYY-MM --limit=30 --format=json
hf papers ls --week=YYYY-Www --limit=30 --format=json
hf papers ls --date=today --limit=30 --format=json
```

If the set is too stale, increase weekly weight and reduce trending weight.

### 4. Add Diversity Constraints Explicitly

After initial relevance ranking, enforce diversity constraints:

- Max 2 papers from the same organization or submitter.
- Max 2 papers with near-identical mechanism phrasing.
- Keep at least 1 "adjacent" paper (high transferability but different approach).
- Keep at least 1 older anchor paper only if it clearly beats recent alternatives.

This prevents shortlist collapse into one sub-community or one method family.

### 5. Deterministic Reranking Rubric

Score each candidate on a 0-5 scale and rank by weighted total:

- Topic fit (weight 0.35)
- Mechanism usefulness (weight 0.25)
- Deployment fit for user constraints (weight 0.20)
- Evidence strength from abstract and metadata (weight 0.10)
- Novelty relative to shortlist (weight 0.10)

Weighted score:

$$
S = 0.35F + 0.25M + 0.20D + 0.10E + 0.10N
$$

Where $F, M, D, E, N \in [0,5]$.

### 6. Two-Stage Read Budget

- Stage A (all candidates): `hf papers info` only.
- Stage B (top 3 to 6): `hf papers read` for full evidence.

Do not read full markdown for low-score candidates.

### 7. Failure Recovery When Results Are Weak

If precision is low:
- Add mechanism terms and reduce limit.
- Restrict to current week or month.

If recall is low:
- Add synonym queries and increase limit.
- Remove one overly specific term.

If diversity is low:
- Add one intentionally orthogonal query.
- Enforce the diversity constraints above before final selection.

## Quality Checks

Before finalizing, ensure:
- Every retained paper was validated with hf papers info.
- Every deep recommendation is backed by hf papers read.
- The shortlist stayed bounded and high-signal.
- Results are scoped to the requested timeframe and topic.
- The final output is decision-ready, not a raw command dump.
- The shortlist satisfies explicit diversity constraints.
- Ranking rationale is reproducible with a visible rubric.

## Validated Example Session

These commands were validated against `hf` CLI `1.16.1`:

```bash
hf --help
hf papers --help
hf papers ls --sort=trending --limit=3
hf papers ls --month=2026-05 --limit=3
hf papers search "edge agent" --limit=3
hf papers search "edge agent" --format=json
hf papers info 2605.23904
hf papers read 2605.23904
```

Notes:
- `hf papers list` is the canonical subcommand and `hf papers ls` is an alias.
- Prefer `--format=json` for automation to avoid wrapped table output.
- `hf papers ls` supports `--date`, `--week`, `--month`, and `--submitter` filters.

## Common Pitfalls

- Reading too many full papers too early.
- Keeping papers with weak mechanism-level relevance.
- Forgetting machine-readable output when scripting is needed.
- Returning a long list with no ranking or rationale.

## Example Prompts

- Use hf papers in balanced mode for edge-agent routing, enforce max 2 papers per organization, and return a scored top-5 with diversity notes.
- Run a precision-mode hf papers workflow for lightweight evaluators in the current and previous month, then return a ranked shortlist with weighted scores.
- Discover model-routing papers with one orthogonal query for diversity, then output top-3 plus one adjacent-method wildcard with risks.