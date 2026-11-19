---
id: cases/research/negative-claim-without-a-search
type: cases
L0: "Two 'no named DS&AI director at Deel' claims shipped with no level-scoped search; an empty theorg chart read as absence. One validator search found a Senior Director."
hotness: 0.7
ttl: 180d
freshness: 2026-11-12
directory: cases/research
provenance: mem:researches/deel-ai-engineering-team-lead-hiring-manager
---

# Case: an existence-negative asserted without a search at that level

scope: cases - one incident plus fix; not a claim (no single atomic fact) and not a trajectory (one occurrence).

## Symptom

A producer twice asserted that "no Director/VP/Head of Data Science & AI at Deel is publicly named" and that a candidate was "the only named person whose title covers that org". A validator found Ido Kissos ("Senior Director, AI - Growth") in a single search and failed the answer twice before a third round settled it on correct org-scope reasoning.

## False hypothesis

That the producer's own several searches had already covered the space, and that theorg.com/org/deel/org-chart rendering no people proved Deel publishes no engineering directors.

## Root cause

An existence-negative was asserted without one deliberate, broadly-phrased search at the exact level being denied, and an empty rendered page was read as evidence of absence rather than as a page that failed to render. Both turns "I did not find it" into "it does not exist" with no step able to falsify it.

## How confirmed

The round-2 validator's single tavily search surfaced Kissos, which alone falsified the negative. The round-3 validator's single search for "VP of AI" / "Director of AI Engineering" / "Head of Data Science & AI" came up empty - what a properly-scoped negative looks like, distinguishable from round 1 only by having been run at the level the claim denies.

## Prevention

1. Before any "nobody at level X is named" claim, run one search phrased at that level and quote its result.
2. Never treat an empty or shell-only page (theorg chart, blocked careers site) as proof that people or the chart do not exist.
3. When a negative claim is load-bearing for the pick, mark the pick LOW until the search backs it.

Source: validator transcripts for this task, rounds 1-3, 2026-11-12.