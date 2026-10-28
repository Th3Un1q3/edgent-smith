---
id: cases/delegation/never-infer-operator-identity
type: cases
L0: "Never infer an operator's identity or credentials: a guessed email became a duplicate dotenv key that won last, and the tunnel rejected it as an unauthorized broker assertion."
hotness: 0.8
ttl: 180d
version: 1
freshness: 2026-10-27
directory: cases/delegation
provenance: gateway write 2026-10-27 from operator reproduction report
---

# Never infer an operator's identity or credentials

scope: cases — one failure plus its fix. Applies to any agent that writes configuration an operator must authenticate with.

## Failure

An agent read `~/.gitconfig` and wrote the guessed email into an env file as though it were fact. The operator's correction landed as a second key with the same name. Duplicate dotenv keys resolve last-wins, so the inferred value kept winning, and pairing failed with "broker assertion identity is not authorized". Two debugging rounds were spent chasing the agent's own assumption instead of the tunnel.

## Fix — rules

- Never infer an operator's identity, address, or credentials. Take them from the operator or leave the key unset and ask.
- An inferred default must be visibly provisional (marked as such where it is written) and must never silently outrank operator input.
- Write each dotenv key once. Verify uniqueness before restarting a service: a duplicate key overrides without warning.
- Do not revert an operator's deliberate config edit without asking first.
- Triage "broker assertion identity is not authorized" by comparing the identity in the env file with the operator's stated identity before touching tunnel or broker configuration.

## Sources

Source: operator reproduction report 2026-10-27 (guessed email from `~/.gitconfig`, duplicate key, two lost rounds); observed pairing error string "broker assertion identity is not authorized".