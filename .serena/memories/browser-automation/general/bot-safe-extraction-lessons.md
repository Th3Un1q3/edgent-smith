# Bot-Safe Extraction Lessons (cross-site)

Cross-site lessons for extracting data from unfamiliar websites without tripping bot detection or blowing the context budget. Source: operator + observed wellfound session, 2026-08-06.

## Lessons

- **Snapshot-truncate-first** — on unfamiliar sites, truncate snapshots/DOM dumps before returning them; a single untruncated snapshot is the #1 token sink (one session consumed ~164K context tokens).
- **Click-first navigation** — after the initial load, navigate by in-page clicks with paced actions (≥1 s inter-action, ≤40 actions/task). Rapid address-bar jumps (repeated new_page/navigate_page) trigger bot detection.
- **Address bar is a bot signal** — use it as fallback only when no clickable path exists.
- **Checkpoint-cache intermediate results** — write `private/<site>/<task>-<date>` at checkpoints; never rely on a single end-of-task write (a bot alert can cut the session with zero cached results).

## Procedure source

Procedure details live in the skill files — `workflows/browser-automation-devtools.md` and `references/devtools-known-issues.md` — not duplicated here.

Evidence: mem:browser-automation/wellfound/remote-engineering-manager-extraction