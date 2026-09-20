---
id: ADR-003
title: Structured subtask output: tag-delimited result_json block
status: accepted
date: 2026-09-20
scope: .opencode/plugins helpers/workflow-subtask.ts structured output - how a subtask returns machine-readable data alongside prose when a JSON Schema is supplied
---

# ADR-003: Structured subtask output: tag-delimited result_json block

## Decision

Use a tag-delimited manual structured-output scheme. A workflow subtask that receives a JSON Schema returns normal free-form prose plus exactly one JSON value wrapped in <result_json> and </result_json>; the runtime detects that block, un-fences it, and JSON.parses it. Without a schema, the output stays plain text. Native SDK format is rejected.

Status: accepted 2026-09-20.

Implementation status: IMPLEMENTED 2026-09-20 in `.opencode/plugins/helpers/workflow-subtask.ts` (tag-delimited contract + `parseTagged`/`parseStructured`; tests in `.opencode/plugins/tests/helpers/workflow-subtask-structured.test.ts`).

### Design (implemented)

Contract: the prompt names the exact tag, allows prose outside it, requires exactly one block, and requires JSON-only inside.

Parser: scan tagged blocks from the LAST opening tag to the FIRST; for each opening tag try successive following closing tags; slice, trim, strip an inner code fence, JSON.parse; first success wins. Fallback: whole-text stripCodeFence plus JSON.parse.

Validation: valid JSON; when schema.required is a non-empty string array, each name must be an own property of a plain object. Retry gating: at most one retry, skipped on timeout, parent abort, info.error, or empty text. Result shape: outputText is the full raw text truncated to MAX_STEP_OUTPUT_CHARS; data is the parsed JSON, never truncated.

Edge cases handled: mixed prose plus tag; tag-only; pure JSON without tags (fallback); fenced JSON without tags (fallback); multiple tagged blocks (last parseable wins); a fence inside the tag; trailing prose after the close tag; an unclosed tag (unusable, retry); a JSON string containing a literal closing tag (later-closer recovery); a missing required key (unusable); a tag-looking example with invalid JSON (ignored); non-object JSON with required (unusable); required absent, empty, or non-string (any valid JSON accepted).

## Considerations

### Decision drivers (hard constraints)

- D1 — one reply must carry BOTH prose and structured data.
- D2 — adhere to the repo XML-ish-tag convention per mem:architecture/adr/ADR-001-envelope-tag-detection.
- D3 — must work on the current default reasoning model without provider or model switches.
- D4 — maximize parse reliability with no new dependencies.

### Context

The workflow subtask must return machine-readable data when the caller supplies a JSON Schema, and plain text otherwise, while still allowing the model to explain itself. Native SDK structured output (opencode v1.18.18, SDK 1.18.14) was explored and rejected: the server hardcodes a synthetic StructuredOutput tool with toolChoice required; the default thinking model/provider rejects forced tool_choice; formatted sessions break GET message read-back; retryCount is not honored. The current runtime parses the entire response as JSON, so it cannot carry prose and data together. Repo convention parses XML-ish tags with precise scanners, not general XML parsers (mem:architecture/adr/ADR-001-envelope-tag-detection).

Provenance of the native-format blockers: verified 2026-09-20 via (a) DeepWiki ask_question on sst/opencode, (b) the v1.18.18 source packages/opencode/src/session/prompt.ts:1243-1248,1285, and (c) decompilation of the installed binary /usr/local/bin/opencode v1.18.18. These claims are externally verified; the OpenCode server source is not vendored in this repo and cannot be checked in-repo.

### Options considered

#### Option A: Native SDK format (json_schema)
Pros: two modes intrinsic; parsed value at data.info.structured.
Cons: hardcoded toolChoice required; default thinking model rejects it; formatted sessions break message read-back; retryCount unhonored; SDK v1 lacks format; no fallback.
Disposition: rejected — violates D1 (no prose alongside the structured value) and D3.

#### Option B: Keep whole-response manual JSON
Pros: no SDK dependency; simple; already implemented.
Cons: cannot mix prose and data; fence delimiter ambiguous; no answer boundary.
Disposition: rejected — violates D1 (a single whole-response JSON value leaves no room for prose).

#### Option C: Tag-delimited embedded JSON (result_json) - CHOSEN
Pros: keeps two modes; prose plus data in one reply; precise scanner not a document parser; follows repo XML-tag convention; whole-text/fence fallback stays backward compatible.
Cons: depends on model compliance with the tag contract; prose could echo the tag; new scanner code to write and test.
Disposition: chosen — satisfies D1 (prose plus data in one reply), D2 (XML-ish tag convention), D3 (prompt-based, no provider switch), D4 (no dependencies; precise scanner).

#### Option D: Markdown fenced block delimiter
Pros: familiar to models; minimal contract.
Cons: collides with ordinary code fences; multiple blocks ambiguous; no clear boundary.
Disposition: rejected — fence collisions and no clear boundary lower parse reliability (D4).

#### Option E: Unique non-XML sentinel (<<<JSON>>>)
Pros: simplest scanning; no XML semantics or escaping.
Cons: less self-describing; diverges from the repo XML-tag convention (ADR-001 Option C).
Disposition: rejected — violates D2 (XML-ish tag convention).

#### Option F: General XML parser (saxes / fast-xml-parser / xmldom / htmlparser2)
Pros: standard XML handling.
Cons: whole-document semantics crash on prose or unbalanced tags; entity-expansion security; adds dependencies; ADR-001 Option B scored -4.
Disposition: rejected — adds dependencies and fails on prose (violates D4).

#### Option G: Per-call nonce tag (result_json id=uuid)
Pros: removes prose echo collisions (ADR-001 UUID-gating lesson).
Cons: less model-friendly; more contract tokens; unneeded until collisions are observed.
Disposition: deferred escalation — only if echo collisions appear.

#### Option H: Provider-native response_format / JSON mode
Pros: provider-level guarantee if exposed.
Cons: no such path in opencode implementation; not viable today.
Disposition: rejected — no such path (violates D3).

#### Option I: Tool-call-as-structured-output
Register or force a custom tool and read its arguments as the structured payload.
Pros: uses the model native tool-call channel; the provider parses the arguments.
Cons: OpenCode native path is exactly this and is blocked by the same tool_choice limitation; the subtask prompt path does not expose or force tools; a tool call cannot reliably carry free-form prose in the same reply.
Disposition: rejected — blocked by the same D3 tool_choice limitation and fails D1 (prose cannot ride alongside the tool call reliably).

#### Option J: Capability-conditional native format
Use body.format only when the model/variant supports forced tool_choice, else fall back.
Pros: native path when available; graceful fallback.
Cons: unusable on the default reasoning model; requires switching structured calls to another model or maintaining a permanent dual path.
Disposition: considered and deferred — violates D3 (default model) and D4 (permanent dual path); the operator chose the manual tag scheme.

### Scoring

Criteria (each -2..+2), per mem:architecture/about - maintainability, flexibility, implementation ease, initial implementation cost (higher = cheaper).

| Criteria | A | B | C | D | E | F | G | H | I | J |
| Maintainability | -2 | +2 | +1 | 0 | -1 | -1 | 0 | -2 | -1 | 0 |
| Flexibility | +1 | -2 | +2 | -1 | +1 | -1 | +2 | 0 | -1 | +1 |
| Implementation ease | -2 | +2 | 0 | +2 | +2 | -1 | -1 | -2 | -2 | -2 |
| Initial implementation cost | -2 | +2 | -1 | +2 | +2 | -2 | -1 | -1 | -2 | -2 |
| Total | -5 | +4 | +2 | +3 | +4 | -5 | 0 | -5 | -6 | -3 |

Constraint override (documented, per ADR rules): raw totals put B, E, and D above C, so selection rests on the hard decision drivers D1-D4, not on raw score. D1 eliminates B (one whole-response JSON value cannot also carry prose) and I (a tool call cannot reliably carry prose in the same reply); D2 eliminates E (a non-XML sentinel diverges from the repo XML-tag convention); D3 eliminates A, H, and J (native forced tool_choice is unusable on the current default reasoning model without provider or model switches); D4 eliminates D and F (markdown fences collide with ordinary code fences and give no clear boundary; F adds dependencies and crashes on prose). Among the remaining options C scores highest; G stays a deferred escalation. C is the selected option.

### Reliability considerations

Ranked mechanisms: an explicit contract naming the exact tag, exactly one block, and JSON-only inside, with prose allowed outside; a precise newline-independent tag scan plus JSON.parse (not a document parser); one same-session corrective retry; a required-key presence check; whole-text and fence fallback; a unique non-generic tag name.

### Consequences

Positive: preserves the two-mode output; lets one response hold prose and structured data; keeps the whole-response path as a backward-compatible fallback; adds no dependencies; aligns with the repo precise-scanner convention.

Negative: reliability depends on model compliance with the tag contract, not a provider guarantee; prose echo of the tag is possible; no full JSON-Schema validation (only required-key presence); the approach remains prompt-based.

Follow-ups: (1) optional per-call nonce tag escalation if echo collisions appear; (2) a derived prose-only field if callers need prose without parsing; (3) full schema validation as a separate decision; (4) implementation landed 2026-09-20 — SCHEMA_INSTRUCTION, SCHEMA_RETRY_INSTRUCTION, schemaBlock, parseTagged, parseStructured, and runTurn updated in .opencode/plugins/helpers/workflow-subtask.ts, plus docs/workflow-tool.md and tests.

### References

Source: OpenCode v1.18.18 server / SDK 1.18.14; server source packages/opencode/src/session/prompt.ts:1243-1248 and :1285; DeepWiki ask_question on sst/opencode; decompiled binary /usr/local/bin/opencode v1.18.18 (all verified 2026-09-20, none in-repo).
Lost OpenCode session ses_f46c72252ffedPscWZruQUjhlt (agent rug) and lost probe session ses_f41f0618effeJE2GxvT1jaH3Ta (Probe native structured output).
Implementation: .opencode/plugins/helpers/workflow-subtask.ts (SCHEMA_INSTRUCTION L388-389, SCHEMA_RETRY_INSTRUCTION L390-391, schemaBlock L393-394, stripCodeFence L136-139, hasRequiredKeys L141-149, parseStructured L153-161, shouldRetryStructured L410-420, runTurn L424-445, classifyResponse L470-511); docs/workflow-tool.md:101-114; workflow.ts:26-32.
mem:architecture/adr/ADR-001-envelope-tag-detection; mem:architecture/adr/ADR-002-memory-system-and-structure.
mem:claims/opencode/sdk_structured_output; mem:claims/opencode/sdk_structured_fallback.

## Addendum: required `description` and step visibility (2026-09-20)

The subtask input contract now makes `description` mandatory. The OBJECT form of subtask input must carry a non-empty `description`; missing, empty, or whitespace-only values raise `TypeError('subtask description must be a non-empty string')` in `normalizeParameters` (`.opencode/plugins/helpers/workflow-subtask.ts`). The STRING shorthand still derives `description` from the prompt, so `subtask('do work')` keeps working.

`description` states what a subtask does, so a caller sees intent without reading the prompt. Truncation uses the new constant `MAX_DESCRIPTION_CHARS = 80` (`.opencode/plugins/helpers/workflow-types.ts`); `workflow-subtask.ts` no longer hard-codes `80`.

Execution visibility: `StepRecord` gained `description: string`, populated by `toStep` and truncated to `MAX_DESCRIPTION_CHARS`, so the envelope `steps[]` name what each executed step corresponds to. This extends the tag-delimited structured-output decision above; it does not replace it.

Implementation: `.opencode/plugins/helpers/workflow-subtask.ts`, `.opencode/plugins/helpers/workflow-types.ts`, `.opencode/plugins/workflow.ts`; docs `docs/workflow-tool.md`; agent `.opencode/agents/rug-debug.md`.
