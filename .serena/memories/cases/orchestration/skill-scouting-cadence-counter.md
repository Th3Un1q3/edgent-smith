---
id: cases/orchestration/skill-scouting-cadence-counter
type: cases
L0: "A skill-scouting cadence is a counter, not a reminder: bind it to the dispatch index and log each pass in the trace. An empty scouting reply is a null parse, not proof that no skill fits."
hotness: 0.6
ttl: 180d
version: 1
freshness: 2026-10-23
directory: cases/orchestration
confidence: 0.7
status: active
provenance: orchestration session review, 2026-10-23
---
# skill-scouting-cadence-counter

fact: A skill-scouting cadence is a counter, not a reminder. A rule that says "scout every 5-10 subtasks" enforces nothing by itself: with no counter, no gate and no checklist item, the cadence runs once and is dropped.

rule: Bind the cadence to a countable trigger, the dispatch index, and record every pass in the trace ("scouting pass at subtask 6: considered skill A, skill B"). An unscouted stretch then shows as a gap in the trace instead of depending on recall, and a pass with no recorded result did not happen.

evidence: The rule existed as prose in the orchestration guidance and nowhere as state. One scouting pass ran at the start; about forty dispatches followed with none, and later stages ran on default judgement. The one pass that did run was misread: its reply arrived as prose because the orchestrator passed no response schema, so the parse returned nothing and the pass was recorded as "no skill fits".

fallback: An empty scouting answer is not proof that no skill fits. It is usually a parse failure or an unasked question. Before concluding that no skill applies, list the available skill names and read the descriptions of the plausible ones; a null parse means re-ask with a schema and a required field.

scope: Orchestrators dispatching subtasks who must re-check skill fit as work changes.

Source: orchestration session review, 2026-10-23; the counts (~40 dispatches, one pass) are the operator's account, not re-derived.