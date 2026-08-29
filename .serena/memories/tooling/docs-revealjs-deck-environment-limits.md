# AI Adoption Deck — Environment Limits (this container)

The dev container is arm64 (OrbStack) with NO runnable Chrome. `node .agents/skills/revealjs/scripts/check-overflow.js docs/new-deck.html` CANNOT run: puppeteer MODULE_NOT_FOUND, and x86-64 Chrome binaries will not run on arm64. Fit verification is estimate-based only — recommend an amd64 devcontainer visual pass before presenting.

## Git index caveats

- The git index holds a STALE older revision of `docs/new-deck.html` (file is in `AM` state) — `git diff` against the index is misleading; validate the WORKING TREE and use `git status --porcelain` for file-scope questions.
- Other pre-existing staged files: `.agents/skills/revealjs/*`, `.agents/skills/unslop/SKILL.md`, `.opencode/agents/rug.md`, `skills-lock.json`. `docs/system-overview.md` is untracked (user's).

## Harness lesson

Skills/instructions/agent changes load at opencode server start — restart required after harness edits. See `mem:troubleshooting/opencode-plugin-live-diagnosis` and `mem:troubleshooting/session-review/opencode-restart-verification-status`.