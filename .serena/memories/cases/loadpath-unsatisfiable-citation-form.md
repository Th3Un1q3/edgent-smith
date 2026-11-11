---
L0: "Prompt asked for the glob/glob-list line for a plugin-loading convention; the artifact is a 253 MB compiled binary with no line numbers, and opencode api /command and /doc return web-app HTML, not a command listing."
name: cases/loadpath-unsatisfiable-citation-form
description: A probe question demanded a file-and-line citation for a loader convention that lives in a 253 MB compiled binary, and the two API endpoints tried first returned web-app HTML.
type: cases
scope: cases
status: active
confidence: 0.8
timestamp: 2026-11-10
tags: [context-gathering, evidence-shape, opencode, compiled-artifacts]
sources: [undefined]
---

# Loader research: an unsatisfiable citation shape

## Failure Modes

- **Symptom.** Search time went into hunting the glob or glob-list line, ending inside a 253 MB compiled binary where no line numbers exist. The dead end before that was opencode api GET /command and /doc, both of which returned web-app HTML instead of a command listing.
- **False hypothesis.** That the server API exposes a command listing at those routes, and that the loader convention exists as a readable source line.
- **Root cause.** The prompt fixed the evidence shape (file plus line) before the artifact shape was known, and named no settling probe. A compiled artifact can only be cited as an extracted string, so the requested format was unsatisfiable by construction.
- **How confirmed.** HTML payloads rather than a listing (reported). The one-call settlers are present and cheap on opencode v2.2.7: plugin list, debug config, debug agents, each verified from the command help this session.
- **Prevention.** Resolve a loader or config behaviour with the live-definitive probe before reading source, and accept an extracted string with surrounding context as the citation form for a compiled artifact.

## Evidence

Source: session observations from the aidlc-workflows integration run (2026-11-10); opencode v2.2.7 subcommand lists verified this session.

## References

mem:cases/loadpath-question-count-overrun — the same child, whose budget this cost.