---
id: cases/orchestration/mediated-read-treated-as-source
type: cases
scope: orchestration
status: active
confidence: 0.85
date: 2026-11-21
freshness: 2026-11-21
hotness: 0.6
ttl: 180d
provenance: "Critique report, fix report and verifier residual note, 2026-11-21 AIDLC research retrospective"
L0: "A citation pointed at :217 for a count stated at :213, and a verifier nearly judged a display-truncated view, because line offsets and completeness were taken from a rendering that adds a header line and caps what it shows."
---

# A mediated read treated as the source

## Symptom
The explainer cited docs/reference/07-sensor-system.md:217 for a count stated at :213. Separately, a memory verifier judged a body from a terminal view the display cap had truncated while the underlying read was complete; it noticed only by re-reading the saved output.

## False hypothesis
What the tool shows is what the file contains, at the same coordinates.

## Root cause
Line offsets and completeness were taken from a rendering layer that transforms content. The gateway read prepends a download-status line, shifting every later source line by one; the display layer caps what it renders at a fixed size. Neither transformation belongs to the source, and nothing subtracted the header offset or compared the rendered length against the read length.

## How confirmed
The critique named the citation its worst defect. The fix report records "The fetch prepends a download-status line, so I subtracted one". The verifier residual note records the display truncation and the re-read that exposed it.

## Prevention
Quote a line number only from the rendering it was measured in, or re-read the source region before quoting, and subtract a wrapper header explicitly. Judge length or completeness from the saved output rather than the display pane whenever the judgement carries a verdict.

Related: mem:cases/orchestration/delegation-prompt-assumptions, mem:cases/verdict-sliced-at-display