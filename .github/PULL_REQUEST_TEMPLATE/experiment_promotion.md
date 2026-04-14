## Experiment: `<name>`

**Hypothesis:**

**Mutation surface:**
- `<file>`

**Eval results:**

| Suite | Pass Rate | Avg Latency |
|-------|-----------|-------------|
| Smoke |           |             |

**Decision:** ACCEPT –

**Rationale:**

---

## Checklist

- [ ] Smoke eval 100% pass rate
- [ ] Latency regression < 20% vs baseline
- [ ] `uv run pytest tests/ -q` passes
- [ ] `uv run python -m ruff check agents/ evals/ tests/` passes
- [ ] `uv run python -m mypy agents/ evals/` passes
- [ ] CI is green
