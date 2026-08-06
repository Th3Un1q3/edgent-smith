# Researches

Per-topic research findings — synthesized conclusions with named sources.

## Scope

- One topic memory per research area: researches/{topic-slug} holding verified findings, concrete commands/config, and categorized known issues.
- Every finding traces to a cached response (mem:cache/...), a fetched doc, or observed output. Unverified theories stay out.

## Boundaries (out of scope)

- Raw fetched content and tool responses — goes to mem:cache/about (cache/{source}/... entries).
- Research process rules and recipes — goes to mem:research-process/about.
- Devcontainer configuration change management — goes to mem:devcontainer-workflows/about.
- Devtools-derived research output (authenticated sessions, PII, job/application data) is NOT stored under researches/ — it goes to `private/` (private namespace — gitignored). Public-source research stays here.

## Related Domains

- mem:research-process/about — how research runs are planned, executed, and gated.
- mem:cache/about — the raw source material this domain synthesizes from.
- mem:devcontainer-workflows/about — devcontainer config lifecycle; config edits live there, conclusions here.