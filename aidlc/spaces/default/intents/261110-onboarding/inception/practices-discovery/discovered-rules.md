# Discovered Rules

## Mandated

ALWAYS treat `.opencode/instructions/*.instructions.md` as binding: read the matching file before editing that type. (AGENTS.md:147)
ALWAYS reach memory through the Serena gateway, never through the filesystem. (AGENTS.md:124)
ALWAYS pass a skill or agent-definition edit through the contradiction sweep before calling it done. (AGENTS.md:126)
ALWAYS route every file added under a skill directory from that skill's SKILL.md Task Routing Table in the same edit. (shaping.instructions.md:11)
ALWAYS justify a threshold change in writing with before/after measurement, then re-run its verification. (threshold-policy.instructions.md:14-15)
ALWAYS name the exact `just` recipe attempted and quote its output when returning an unverifiable verdict. (test-run-commands.instructions.md:38)
ALWAYS report a denial with the exact command, the denial, and the intended outcome. (no-permission-workarounds.instructions.md:23)
ALWAYS run tests, lint and typecheck through `just`; raw `pytest`, `npm test`, `vitest`, `bun` and `tsc` are banned. (test-run-commands.instructions.md:27)

## Forbidden

NEVER use a `src/` layout; `agents`, `cli` and `evals` stay at the repo root. (AGENTS.md:140)
NEVER activate a virtualenv manually. (AGENTS.md:141)
NEVER duplicate command logic; shared setup moves to `cli/services/`. (AGENTS.md:142)
NEVER add generic documentation such as "how to install python" to project files. (AGENTS.md:143)
NEVER read, `ls` or `grep` `.serena/memories/*` from the filesystem. (AGENTS.md:124)
NEVER reproduce a gated action via a wrapper, subprocess, alternate tool or other path. (no-permission-workarounds.instructions.md:17)
NEVER lower a threshold, replace a pinned number or downgrade an error to `warn`. (threshold-policy.instructions.md:11)
NEVER add a scoped recipe to the root `justfile`. (justfiles.instructions.md:20)
