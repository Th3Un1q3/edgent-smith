---
id: cases/orchestration/stray-root-node-modules-from-cwd-dependence
type: cases
L0: "Stray /workspace/node_modules with only .vite/vitest results: an ad-hoc vitest run from the repo root; config resolved aliases via process.cwd() and set no root or cacheDir."
hotness: 0.5
ttl: 180d
version: 1
freshness: 2026-11-10
directory: cases/orchestration
provenance: operator report 2026-11-10; .opencode/vitest.config.ts; .gitignore:118
---

# Stray root node_modules from a cwd-dependent vitest config

## Symptom
/workspace/node_modules appeared containing only .vite/vitest/<hash>/results.json. The results payload listed tests at .tmp/retired-plugins/tests/instructions-loader.test.ts and .opencode/plugins/tests/instructions-loader.test.ts.

## False hypothesis
An install (npm or bun) created it. Refuted: no root package.json and no root lockfile exists.

## Root cause
An ad-hoc vitest invocation run from /workspace. .opencode/vitest.config.ts resolved aliases through process.cwd() and set neither root nor cacheDir, so the @tests/@plugins aliases and setupFiles resolved to /workspace/plugins (and /workspace/plugins/tests/...), and vitest defaulted its cache to /workspace/node_modules/.vite, creating the stray tree at the repo root.

## How confirmed
- The cache payload paths are cwd-relative to /workspace, not to .opencode/.
- /workspace/plugins does not exist, so the aliases could only come from a cwd-based resolve.
- The correct cache at .opencode/node_modules/.vite was untouched, ruling out a run rooted at .opencode.

## Prevention
- .opencode/vitest.config.ts pins root to the config directory and cacheDir to <configDir>/node_modules/.vite, and resolves setupFiles absolutely against the config directory.
- /node_modules/ is ignored in .gitignore, so a stray root cache stays untracked.
- Run plugin tests through `just opencode::test`, not an ad-hoc vitest from /workspace.

Source: operator report 2026-11-10; observed .opencode/vitest.config.ts; .gitignore:118-119.