# OpenCode Restart-Dependent Verification Status

OpenCode plugin changes load at server start; plugin behavior must be live-verified after a restart with interactive sessions (operator-in-the-loop). See mem:troubleshooting/opencode-plugin-live-diagnosis.

## Pending (UNVERIFIED until executed)

- Live checks for steps 1e/6e/8e/9e require an opencode restart + interactive sessions (runtime-log correlation with timestamps).
- Plan §9 ASSUMPTION check: whether inert `<skill>` tags are natively expanded by the opencode core binary (observed on first restart).

Related: mem:refactoring/session-review/command-evidence-spine.