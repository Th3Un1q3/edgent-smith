# Reference: Verification and Hygiene

Verify an install from the installed artifact, classify every smoke outcome, and keep secrets and telemetry out of config. Use after any install and when auditing setup scripts.

## Vocabulary

- **introspection** — reading a tool's own config/state back (`--dump-config`-style) to prove the loaded shape.
- **native-load check** — a `require()` of a native module to prove it binds.
- **bounded smoke** — one time-limited end-to-end run of the tool, then a classification; no retry loops.
- **env-var indirection** — config stores the env-var NAME; the process supplies the value at runtime.

## Introspection

Run the tool's own config dump to prove the installed artifact parses its config with the shape the package defines:

```bash
dsh --dump-config
```

PASS means the dump returns the expected keys. This also catches the schema class of failure ([workflows/debug-install-failure.md](../workflows/debug-install-failure.md) Classification 5).

## Native-load checks

Load each native dependency directly to prove it binds against the running node:

```bash
node -e "require('node-pty')"
node -e "require('koffi')"
```

PASS means each require returns without error. Follow with a PTY/exec smoke when the tool wraps a PTY.

## Bounded smoke classification

Run one bounded smoke, then classify: PASS (tool performs its documented behavior), PASS-WITH-CAVEAT (external cause — quota 403, upstream metadata), FAIL (config-side cause). No retry loops — one attempt, then classify and fix per [workflows/debug-install-failure.md](../workflows/debug-install-failure.md).

```bash
timeout 10 <tool> <documented-self-check>
```

Report one classification per check.

## Secret hygiene

Store env-var NAMES in config, never values; the process reads the value at runtime (dsh `apiKeyEnv: OPENROUTER_API_KEY`). Use `!!js` template literals for header expressions that reference env vars. Name env vars in reports; print no secret values.

```json
{"apiKeyEnv": "OPENROUTER_API_KEY"}
```

## Telemetry

Prefer disabled telemetry defaults; set opt-out env vars in the devcontainer when a tool ships telemetry on — repo precedent `RTK_TELEMETRY_DISABLED=1`; dsh `session-telemetry-otel` defaults to DISABLED.

```bash
export RTK_TELEMETRY_DISABLED=1
```
