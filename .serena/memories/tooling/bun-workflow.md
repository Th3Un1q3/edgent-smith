# Bun Workflow (bun 1.3.14)

- `bun install` / `bun add` produce a text `bun.lock` (JSON), not the legacy binary `bun.lockb` — commit it.
- `bunx serve . -l 8000` is the simplest static server: `serve` auto-installs into bun's global cache on first `bunx` run, adding no project dependency.
- `bun add` / `bun install` work in a subdir with a hand-written `package.json`; `bun init` is not required.
- No `bun serve` builtin exists — `bunx serve` is the way to serve static files.