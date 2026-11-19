---
id: projects/opencode-workflows/user-stories/backlog_could
L0: "Could backlog: YAML frontmatter ingestion via JSON Schema bridge, vocabulary derived from declarations, metadata consumers, first state split"
freshness: 2026-11-17
directory: projects/opencode-workflows/user-stories
ttl: 180d
provenance: design session 2026-11-17; SIGNALS-CONTRACT.md section 2
---
# Could backlog

Priority: Could. None blocks the current loop.

## US-09 — YAML frontmatter ingestion

States are authored as YAML documents whose frontmatter becomes the loop config. The signals block maps one-to-one (contract section 2). Payload schemas are JSON Schema, parsed with JsonSchema.fromSchemaDraft2020_12 and SchemaRepresentation.fromJsonSchemaDocument. Tests must cover keyword coverage beyond the verified decode and path reporting, the examples annotation, and parity with the TS declarations.

## US-10 — Vocabulary derived from declarations

Remove TOOL_SIGNALS as a hand-written union once the loop is data. Derive the union from SESSION_LOOP with as const, or generate it from YAML at build time. The constraint: LoopEventType and XState transition-key checking keep literal types.

## US-11 — Metadata consumers

Branch logs and workflows on the refusal code. A small reader in the plugin records code, signal and state; no behaviour change and no new message. Add only when a consumer exists.

## US-12 — First real state split

Split work into work_plan and work_confirm when a second signal is actually needed. Acceptance covers entry emits, skill injection not repeating, idle arms on both states, snapshot restore into the second state, and the tool policy staying absent in both.

## How to demo (when built)

- US-09 YAML: golden test; parse a fixture and compare the compiled loop object to the TS declaration; malformed frontmatter fails with the field named. No live run.
- US-10 vocabulary: typecheck plus a test that every declaration compiles into LoopEventType; no live run.
- US-11 metadata consumers: a plugin test asserting the consumer record carries code, signal and state; no live run.
- US-12 state split: actor tests for entry, idle and restore in both states, plus the US-08 live run extended to the second signal in the same turn.

## Why deferred

US-09 and US-10 depend on the YAML stage. US-11 has no consumer yet. US-12 has no second signal yet; inventing one would add a state the loop does not need.