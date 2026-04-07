# Failure Triage

Use this prompt when an experiment fails eval or CI and you need to diagnose why.

---

## Prompt

Experiment `<EXPERIMENT_NAME>` has failed at the `<SUITE>` eval stage.

Read the following files to diagnose the failure:
- `experiments/manifests/<EXPERIMENT_NAME>.json` – candidate results including per-case details
- `experiments/baselines/current.json` – baseline for comparison

Answer the following questions:

1. **Which cases failed?** List the case IDs and the failure reason (missing keywords, latency, abstain mismatch, exception).
2. **What is the root cause?** Did the prompt change cause the agent to:
   - Omit required information?
   - Hallucinate or refuse incorrectly?
   - Exceed latency or token budget?
   - Fail to abstain when it should?
3. **Is the failure fundamental?** Would a small refinement fix it, or is the hypothesis itself flawed?
4. **Recommended next step**: 
   - Refine the change and re-run? (If so, what specifically to adjust)
   - Reject and try a different hypothesis?
   - Revert to baseline?

Rules:
- Do not change the eval harness or thresholds to make the candidate pass
- Do not mark a failed experiment as accepted
- Document the failure reason in the manifest `rationale` field
