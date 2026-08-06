# Skill-Envelope Session Retrospective

Process lessons from building the skills-loader envelope mechanism through a RUG-style session (decompose, TDD subagents, separate validation, quality gates, live verification). Source: operator-verified retrospective of that session.

## When building plugin mechanisms, do differently next time

- Clarify design constraints UP FRONT: storage scope (in-memory vs disk-backed), tag genericity (generic vs skill-specific), and documentation placement (AGENTS.md vs memory-only). Under-specified requirements caused repeated implement, validate, operator-correct iterations. Operator decisions that ended the churn: in-memory store (short-lived between two same-process hooks), generic `<envelope>` tag, memory-only docs (AGENTS.md must not contain emergent behaviors).
- Live-verify hook wiring: mandatory, cannot be replaced by unit tests. The pipeline final live step caught a bug all unit tests missed. Restart-to-apply keeps plugin verification operator-in-the-loop.
- When testing a detection mechanism, either keep the stimulus free of the detected strings or make the mechanism robust to such prose: the live test prompt itself contained tag-shaped examples and defeated loose substring detection. Precise UUID-shaped id detection is the robust fix (mem:troubleshooting/opencode-plugin-live-diagnosis).

## What worked

- TDD plus independent validation subagents made each implement/validate iteration cheap.
- In-memory store with one-time delete-on-read (resolveEnvelope get+delete) made envelope semantics airtight - atomic in the event loop.

## Related

- mem:troubleshooting/opencode-plugin-live-diagnosis - the bug this session produced and its diagnosis
- mem:refactoring/skills-loader-envelope-mechanism - the mechanism built
- mem:subagent-workflows/prompt-discipline - prompt drafting rules that kept subagent iterations cheap
- mem:refactoring/permission-hooks - live-vs-unit divergence precedent
