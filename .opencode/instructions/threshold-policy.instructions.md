---
name: threshold-policy
description: "Edit-time guards on threshold and lint config files: never lower, warn, or escape a gate."
applyTo: "{.opencode/stryker.config.mjs,.opencode/vitest.config.ts,.opencode/plugins/config/harness.ts,pyproject.toml,.opencode/eslint.config.js,.env.example,scripts/verify_thresholds.sh}"
---

# Threshold Policy

The pinned values and their checks live in `scripts/verify_thresholds.sh`; this file covers edits to the matched config files.

- Never lower a threshold, replace a pinned number, or downgrade an error to `warn` to make a gate pass. Fix the code or test that fails.
- No `try: true` overrides in `.opencode/eslint.config.js`. Fix the violation at the source.
- No active `SKIP_MUTATION=` assignment in `.env.example`; it is a local invocation flag, never committed state.
- A tightened rule voids every earlier "zero violations" measurement. Re-run the full lint with the new config before claiming zero, fix the surfaced sites in the same change, and update the matching pin in `scripts/verify_thresholds.sh`. An allow-list entry or an `_` ignore escape exists because the violations exist; removing it without re-measuring turns a premise into a silent claim.
- Any threshold change needs a written justification plus a before/after measurement, reviewed; without both the change is rejected.
- Verify an edit with `bash scripts/verify_thresholds.sh`.
