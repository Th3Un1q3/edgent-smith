---
id: cases/payload-shape-consumer-coupling
type: cases
L0: "Injected <skill> shape changed and session_parts.py, which expected a path attribute after name, silently dropped delegated loads; grep every reader before changing a payload tag."
hotness: 0.5
ttl: 180d
version: 1
freshness: 2026-11-11
directory: cases
provenance: operator report of the 2026-11-11 orchestration run
claim_ids: []
---

# Payload shape change broke a consumer regex

Source: operator report of the 2026-11-11 orchestration run; the repo shows the consumer and its repair (`.agents/skills/session-insights/scripts/session_parts.py:293-296`, `skill_tags()` at :301).

## Symptom
Changing the injected skill element shape - the `<skill>` element inside the `<task_skills>` payload written by the opencode plugin - silently broke `.agents/skills/session-insights/scripts/session_parts.py`. Its `SKILL_TAG_RE` required a `path` attribute directly after `name`, so delegated skill loads matched nothing and were dropped with no error.

## False hypothesis
The plugin that writes the payload is the only place to check: once the producer emits the new shape and its own tests pass, the change is done.

## Root cause
The payload is a contract with readers outside `.opencode/plugins`, and no prompt named them. The producer's tests exercised only the producer, so the consumer's attribute assumption failed silently instead of raising.

## How confirmed
A fresh validator exercised the consumer against a real injected payload and the regex yielded nothing; the fix added `skill_tags()` accepting both the attribute and content-line forms.

## Prevention
Before changing a tag or attribute, grep every reader of the payload and name that list in the change. Related: mem:cases/opencode/sdk_skills_injection.
