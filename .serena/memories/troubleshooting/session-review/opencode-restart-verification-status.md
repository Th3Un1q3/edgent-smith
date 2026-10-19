# OpenCode Live-Verification Status

OpenCode v2 hot-reloads plugin and instruction changes; no manual restart is required (restart only for unwatched local plugin dependencies or nested instruction edits). Plugin behavior must still be live-verified with interactive sessions (operator-in-the-loop). See mem:troubleshooting/opencode-plugin-live-diagnosis.

## Pending (UNVERIFIED until executed)

- Live checks for steps 1e/6e/8e/9e require a reload + interactive sessions (runtime-log correlation with timestamps).
- Plan §9 ASSUMPTION check: whether inert `<skill>` tags are natively expanded by the opencode core binary (to be observed on reload).

Related: mem:refactoring/session-review/command-evidence-spine.