# Fresh-reader review — .agents/skills/context-gathering

Scope: SKILL.md, references/, workflows/, recipes/ (19 files, 3478 lines). Read-only; no edits.
Per line: why is this here, what does it mean, so what.
Recorded: 25 worst of about 50 findings; about 25 more below in summary form.

## Provenance stamps, session anecdote, self-referential history

1. references/devtools-known-issues.md:3 — "Verified facts from live sessions (2026-08-06). ... re-verify the tool list on sandbox activation" — a date-stamped provenance line; also assumes an activation step that SKILL.md:98 forbids.
2. references/devtools-known-issues.md:5,11,33,35,36,47 — "(verified 2026-08-06)", "(observed 2026-08-10)", "(verified live 2026-08-13)", "(observed session 2026-08-16)", "exact text not captured 2026-08-06 — re-verify on first use" — the reader needs the failure mode, not who checked when.
3. references/devtools-known-issues.md:34 — "Observed signal: UNVERIFIED — the alert fired, but the exact signal text was not recorded." — the entry exists so a reader can recognise the signal, then admits it cannot.
4. references/server-selection.md:81 — "wellfound.com returns 403 on plain fetch — devtools is the required path (operator-verified 2026-08-06)." — single-site, date-stamped claim no reader can check.
5. recipes/research-with-caching.md:13 — "Live-run proof: ONE cache-first research task cached 17 responses ... produced researches/connecting-chrome-dev-tools-from-devcontainer ... with zero raw dumps in context." — unreproducible session anecdote citing memories the reader cannot open.
6. recipes/external-content-caching.md:15 — "Live-run proof: ONE gateway_mcp-exec call drove ~121 MCP tool calls end-to-end ..." — same; the counted run is unverifiable and the tool name is retired.
7. recipes/external-content-caching.md:275 — "Never reuse a prior run's label (e.g., writing 'Run 2' when this is Run 3+) — stale labels corrupt provenance." — narration about earlier runs in an unnamed session.
8. recipes/external-content-caching.md:336 — "a hand-crafted summary ... the youtube-research postmortem failure" — points to an incident no reader can retrieve.
9. SKILL.md:121 — "Call the gateway tool directly (code mode still available, no longer recommended)" — history of a prior recommendation the reader never saw.
10. references/caching-rules.md:3 — "Canonical home of every cache rule previously carried in the root SKILL.md." — "previously" is unactionable.

## Version drift and retired-tool contamination

11. SKILL.md:13-15 — version "1.25.4" sits above delta "1.25.5 — gateway tools are called directly by name ..." — version and delta disagree; a changelog line in a skill header.
12. references/caching-rules.md:50 — "split tavily, fetch, deepwiki, github into separate gateway_mcp-exec calls" — retired tool name, and contradicts SKILL.md:84 (batch independent calls).
13. references/truncation-examples.md:3 — "Scripts assume the gateway_mcp-exec code-mode environment" — the reference's whole premise is the retired path.
14. workflows/refinement-discovery.md:8 — "This workflow requires the [Setup workflow] (server discovery + code-mode activation) ... Use the canonical tool naming: gateway_mcp-find / gateway_code-mode / gateway_mcp-exec." — the named "canonical" tools are the retired ones; the workflow is unusable as written.
15. workflows/browser-automation-devtools.md:24 — "Attempt the actual tool path (gateway_mcp-find then gateway_code-mode then gateway_mcp-exec against the devtools server)" — a down-verification procedure built on retired tools.
16. recipes/filesystem-access.md:15 — "the tool is exposed to mcp-exec under the returned prefixed name" — describes a per-server activation/prefix model the root explicitly denies.
17. recipes/_template.md:15-17 — the recipe template tells authors to "activate code-mode" with gateway_code-mode — every new recipe inherits the stale model.

## Internal contradictions (reader cannot act)

18. references/devtools-known-issues.md:48 — "Strip the json fence, parse from first { to last }" — issue #11 (line 28) states that exact slicing fails on plain-string returns. The summary table contradicts the body.
19. references/truncation-examples.md:167 vs references/server-selection.md:90 — "never call the same tool on the same target more than 2x total in one script" vs "in one session" — the same hard cap has two different scopes.
20. references/caching-rules.md:72 — "private/ is gitignored, session-derived" — line 7 of the same file says cache/, researches/, private/ are Serena memory domains, "never filesystem paths"; a reader cannot tell which is true.
21. workflows/scripting-workflow.md:5 — "Make sure to perform servers discovery and code mode activation steps in the [Setup workflow]" — actor-less instruction that contradicts SKILL.md:98 ("No activation step").
22. workflows/scripting-workflow.md:35 — "Always wrap every tool call in try/catch" — references/content-fetch-api.md:33 says tools return errors as normal results, so try/catch cannot catch them.
23. recipes/batch-browser-automation.md:166 — "20 entities = 10 batches of 2 = 40 exec calls + 2 smoke-test calls ... = 42 total" then, same sentence, "the per-task <=40-action budget spans the whole task" — the worked arithmetic exceeds the budget it is checked against.

## Broken or dangling artefacts

24. references/truncation-examples.md:36 — a bare closing brace after the commented-out one-liner (lines 33-35): the first, flagship example does not parse, so copy-paste fails.
25. recipes/external-content-caching.md:340 — "public mem: refs never link into private/cache per ... references/okf-sidecar-and-uri.md" — that file does not exist anywhere in this skill.

## Additional findings not itemised (about 25 more)

- SKILL.md:53 "Three entry points share one preamble" — three entry points are never named; the flow chart has 15 nodes.
- SKILL.md:90 "<=5 exec calls per batch -> <=2 entities per batch" — two different units joined by an arrow with no derivation.
- SKILL.md:138 "## ADR-002 Invariants" — no ADR-002 exists in the skill or its links.
- SKILL.md:144 "docker-mcp-gateway — operates the gateway that hosts the gateway_* servers" — gateway_* naming contradicts the flat-name rule at SKILL.md:26.
- references/server-selection.md:62 "Rows 12-13 are pipeline and meta exceptions ... Rows 3-4 start with the cheapest probe" — the table has no row numbers and row 3 is github.
- references/server-selection.md:106 "this matrix must be re-verified whenever a server is added" — maintainer instruction inside a usage reference, no actor.
- references/server-selection.md:43 "Adding servers to that set later costs a re-activation" — presupposes a server-set activation that does not exist.
- references/caching-rules.md:11 "This is the default — no reminding needed." — tautology.
- references/devtools-known-issues.md:30 "Root cause UNVERIFIED." — bookkeeping marker with no resolution path.
- workflows/scripting-workflow.md:25 vs 72 — rule says single quotes only; the canonical example uses double quotes.
- workflows/browser-automation-devtools.md:52 vs 130 — "Names may drift ... never assume exact names" vs an exact list of memory names.
- workflows/browser-automation-devtools.md:64 "the :has() selector resolves to the OUTERMOST ancestor" — unsourced browser claim, no consequence stated.
- references/content-fetch-api.md:21 "Not probed in this run — verify shape before relying on it" — "this run" has no referent for a reader.
- references/content-fetch-api.md:27 max_chars "UNDOCUMENTED" — the skill depends on an undocumented parameter with no fallback.
- references/filesystem-server-api.md:48 "9 allowed directories (relative to the container workspace root)" then lists absolute /workspace paths.
- references/filesystem-server-api.md:62 "snapshot of this workspace's server catalog; re-verify it on catalog change" — provenance/meta.
- references/filesystem-server-api.md:15,86 "24-tool surface" — brittle hand-maintained count.
- recipes/github-insights.md:80 "github_search_issues({ query, ...filters })" — no such tool; the reference names search_issues.
- recipes/github-insights.md:9,160 "store-memory recipe" — no such recipe in this skill's routing table.
- recipes/codebase-exploration.md:3 "via a code-mode environment (code-mode-codebase-exploration)" — a sandbox name nothing creates.
- recipes/batch-browser-automation.md:3 "via a code-mode environment (code-mode-<site>-<task>)" — placeholder passed off as a name.
- recipes/batch-browser-automation.md:34 "<=2 entities per batch" vs recipes/research-with-caching.md:230 "after every 5-10 entities" — contradictory batch sizes.
- recipes/research-with-caching.md:255 "Why 5-10 and not per-entity ... tune in site memory" — no evidence, unactionable.
- recipes/filesystem-access.md:229 "use a descriptive name when activating code-mode ... pass the full returned name to mcp-exec" — activation model again.
- references/caching-rules.md:26 one-line "Vocabulary:" paragraph defines six terms (HIT/MISS/mem:/OK-FAIL/about-first/phase labels/HARVEST) in a single unreadable line.
- recipes/external-content-caching.md:377,381 duplicated ("This section is an EXAMPLE" then "NOTE") — two preambles before the same section.
