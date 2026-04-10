# Failure Triage

Use this prompt when an experiment fails during implementation or evaluation.

## Instructions

Read the failure comment on the issue and answer:

1. **Which step failed?** (tests / lint / eval / branch creation / PR)
2. **Root cause**: concisely describe why it failed.
3. **Is the failure fundamental?** Would a small fix resolve it, or is the hypothesis flawed?
4. **Recommended action**:
   - Refine and retry (describe the specific change to make)
   - Reject and close the issue (hypothesis is invalid)

Post your triage as a comment on the issue using:
```
gh issue comment <NUMBER> --body "<your triage>"
```

Do not modify the eval dataset or CI to make a failing experiment pass.
