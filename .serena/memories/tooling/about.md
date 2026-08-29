# Tooling

Conventions and operational knowledge for JS/bun/docs tooling in edgent-smith: reveal.js setup in docs/, bun workflow facts, justfile recipe conventions, static-serve gotchas, and DeepSeek Harness CLI (dsh) operations.

## Scope

- docs/ reveal.js presentation setup and serving.
- Bun-specific workflow facts (text bun.lock, bunx serve).
- justfile conventions for JS/bun recipes.
- DeepSeek Harness CLI (dsh): install/pinning, settings schema, plugin enablement, sandbox backend, devcontainer persistence, provider state, docs/just integration, behavior notes — mem:tooling/deepseek-harness/install-pinning and siblings.

## Boundaries (out of scope)

- External research on reveal.js/bun versions and package internals: mem:researches/revealjs-bun-setup.
- Diagnosis/root-causing of runtime failures: mem:troubleshooting/about.
- General dev-container change-management process (dsh-specific persistence facts stay in this domain): mem:devcontainer-workflows/about.

- docs/ deck artifact knowledge (new-deck.html): file/purpose, structure, conventions, invariant counts, environment limits, speaker notes — mem:tooling/docs-revealjs-deck-ai-adoption and siblings.