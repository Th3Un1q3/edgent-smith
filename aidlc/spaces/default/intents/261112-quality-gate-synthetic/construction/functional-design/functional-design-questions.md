# Functional Design Questions

## Q1. [architect] Shared helper boundary

Which module layout should the consolidated helpers use, given that only one helper today is truly duplicated (`readFilePath` in both entry points) and that `buildSteeringMessage` already lives in `helpers/instruction-payload.ts`?

- A. Add `helpers/tool-input.ts` for path extraction and workspace-relative conversion, move the steering builder into `helpers/steering-message.ts`, and have both plugins import them; leave `instruction-payload.ts` as a thin re-export so nothing else breaks
- B. Put the path helpers into the existing `helpers/session-helpers.ts` and import the steering builder from `instruction-payload.ts` where it already lives; move nothing
- C. Create one `helpers/plugin-support.ts` that holds path extraction, relative conversion, and the steering builder, and delete the moved definitions from their current files
- D. Other (please specify)

[Answer]: A. New helper modules: tool-input.ts and steering-message.ts, with instruction-payload.ts as a thin re-export

## Q2. [architect] Delivery failure handling

If `session.synthetic(...)` throws or rejects, what should the gate enforcer do?

- A. Log a warning with the failure and let the tool call continue; a signal failure must never block an edit or write
- B. Fail the tool call so the failure is visible to the agent
- C. Retry the append once, then log a warning and continue
- D. Other (please specify)

[Answer]: A. Log a warning and let the tool call continue

## Q3. [architect] Message correlation

Should the synthetic gate message carry metadata beyond its text, so a reader can correlate it with the gate that produced it?

- A. Yes — include the gate name and the status transition in `metadata`, with no message `id` (the runtime rejects an id without a `msg_` prefix)
- B. No — the text alone is enough
- C. Yes — also carry a per-session token that suppresses a repeated identical message, as instructions-loader does
- D. Other (please specify)

[Answer]: A. Include the gate name and status transition in metadata, with no message id

## Consolidated Summary Confirmation

- Consolidated helpers use new modules: `helpers/tool-input.ts` for path extraction and workspace-relative conversion, and `helpers/steering-message.ts` for the steering builder; both plugins import them, and `instruction-payload.ts` stays as a thin re-export.
- If `session.synthetic(...)` fails, the plugin logs a warning and lets the tool call continue; a signal failure never blocks an edit or write.
- The synthetic gate message carries the gate name and the status transition in its `metadata`, with no message id.

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
