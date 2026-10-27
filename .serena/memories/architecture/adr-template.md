---
id: ADR-NNN
title: <short title>
status: <draft | proposed | accepted | rejected | superseded>
date: YYYY-MM-DD
scope: <system area this decision covers>
---

# ADR-NNN: <title>

## Context

Optional problem statement: the problem, constraints, and facts that make a decision necessary. May precede `## Criteria`; it states the problem, not the answer.

## Criteria

3 to 5 criteria chosen for THIS decision's dominant risk — not a fixed universal set. Per criterion, one line: the name, what it measures on the -2..+2 scale, and why it belongs to this decision's kind (security of exposure for a decision that widens the attack surface; familiarity/operational load for a decision an operator must run repeatedly). Close with why this set fits and which criteria a reader might expect but that were rejected as non-discriminating here.

## Options considered

At least two options, each with pros AND cons. Options that fail a non-negotiable requirement are still recorded here.

## Non-negotiable requirements

Hard, testable filters, distinct from criteria: each is stated so a reader can mark an option pass or fail, and derives from the actual constraint set (user constraints, security floor, existing repo invariants) — never invented to fit a favourite option. An option failing any requirement is ineligible: record it, name the requirement it violates, mark it filtered out, and exclude it from the totals. If one option is left eligible, say so plainly.

## Scoring

Every eligible option scored on every criterion, -2..+2, with explicit totals; scores stay unweighted unless the ADR states and justifies weights. Filtered-out options are excluded.

| Criterion | Opt A | Opt B | Opt C |
| <criterion> | <score> | <score> | <score> |
| Total | <sum> | <sum> | <sum> |

## Decision

The output of criteria + options + non-negotiables + scoring: one or two declarative sentences stating WHAT was decided — "<what is decided> <chosen approach>" plus the essential implementation detail, in declarative voice, readable standalone. Do not recap scores, list rejected options, hedge ("probably", "might"), or use relative language ("better", "close").

## Consequences

What changes as a result of this decision, and any constraint override recorded here.
