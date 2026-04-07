## Experiment Promotion: `<name>`

**Hypothesis:**

**Mutation surface:**
- `<file>`

**Eval results:**

| Suite     | Pass Rate | Composite Score | Avg Latency |
|-----------|-----------|-----------------|-------------|
| Smoke     |           |                 |             |
| Benchmark |           |                 |             |
| Holdout   |           |                 |             |

**Decision:** ACCEPT –

**Rationale:**

---

## Checklist

- [ ] All three eval stages passed their thresholds
- [ ] Latency regression < 20% vs baseline
- [ ] `pytest tests/ -q` passes
- [ ] `ruff check src/ tests/` passes
- [ ] `mypy src/edgent_smith/` passes
- [ ] `experiments/baselines/current.json` updated
- [ ] Manifest status = promoted
- [ ] CI is green
