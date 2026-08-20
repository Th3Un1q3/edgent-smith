# Review Document Contract

`review-start` (agent_utils/justfile) pre-fills review.md mechanically: §1 from `session_parts.py info`, §3-§7 from `summary --format markdown` (AUTO-FILL splice markers in templates/review-document.md), §0 from problems.md. Fail-safe WARNING lines leave placeholders for the agent - content is never invented.

- review.ts plugin emits `<!-- problem-id: <source>:<thresholdName> -->` comment lines under each ## heading in problems.md; session-analysis Step 2 consumes them.
- session-insights session-audit.md question list: Q1-Q7 + Q9 (Q8 deleted; Q9 reads review.md §7, no recompute); each Q uses exactly one retrieval method.

Related: mem:refactoring/session-review/command-evidence-spine, mem:troubleshooting/session-review/session-parts-cli-resilience-gotchas.