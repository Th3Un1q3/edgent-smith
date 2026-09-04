# Settling Conflicting Claims

**Use when:** two sources (research reports, docs, subagents) disagree about a fact that determines the architecture.

## Pitfalls

- Averaging conflicting claims → wrong design.
- Trusting a confident single source over direct evidence.

## Rules

1. Design a decisive empirical test: start the process, probe it (HTTP/CLI), kill by PID.
2. Prefer direct observation over secondary claims when the fact matters.
3. Record what the test actually returned (status codes, output) as evidence.