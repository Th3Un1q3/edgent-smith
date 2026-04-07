# Analyze Results

Use this prompt when Copilot should analyze the eval results for an experiment.

---

## Prompt

You are analyzing the eval results for experiment `<EXPERIMENT_NAME>`.

Read the following files:
- `experiments/manifests/<EXPERIMENT_NAME>.json` – candidate results
- `experiments/baselines/current.json` – baseline results

For each eval suite that was run, answer:

1. **Pass rate**: Did the candidate meet the threshold? (smoke: 100%, benchmark: 80%, holdout: 75%)
2. **Composite score**: Did the candidate match or improve vs baseline?
3. **Latency**: Did the candidate stay within 20% of baseline latency?
4. **Token budget**: Were responses within the token budget?
5. **Abstain behavior**: Did abstain cases behave correctly?

Then provide:

6. **Overall assessment**: Should this candidate be accepted or rejected?
7. **Which cases improved?** List case IDs.
8. **Which cases regressed?** List case IDs and explain why.
9. **Simplicity**: Is the change simpler than the original? Same? More complex?
10. **Recommendation**: Accept (proceed to next eval stage or promote) or Reject (explain what to change next).

Base your recommendation strictly on the thresholds in `EXPERIMENT_RULES.md`. Do not override them.
