---
id: ADR-NNN
title: <short title>
status: <draft | proposed | accepted | rejected | superseded>
date: YYYY-MM-DD
scope: <system area this decision covers>
---

# ADR-NNN: <title>

## Decision

The Decision is a clear, self-contained statement of WHAT was decided — one or two declarative sentences that read standalone.

How to form a good decision message:
- Form: "<what is decided> <chosen approach>" plus the essential implementation detail — e.g., "One-time envelope implemented as an XML tag and parsed with a regex."
- Test: a reader who reads ONLY this section must understand the outcome. If you need the scoring or options to make sense of it, it is not self-contained.
- Do: state the concrete choice (technology, pattern, structure); use declarative voice ("is", "uses", "implemented as"); name the key mechanics.
- Don't: recap scores ("wins with +7"), list rejected options, hedge ("probably", "might"), or use relative language ("better", "close").

The analysis (options, pros/cons, scoring, and any constraint overrides) lives in Considerations below. Best total score wins; note any constraints that override scores in Considerations.

## Considerations

### Context

Why this decision is needed: the problem, constraints, and relevant facts.

### Options considered

#### Option A: <name>
Pros:
- ...
Cons:
- ...

#### Option B: <name>
...

### Scoring

Criteria (each scored -2 to +2):
- Maintainability — ease of understanding and evolving over time
- Flexibility — adaptability to future requirements
- Implementation ease — straightforwardness with the current stack
- Initial implementation cost — effort to build (higher score = cheaper)

|Criteria | Opt A | Opt B | Opt C |
| Maintiainability| -1 | -2 | 0 |
| Flexibility | 2 | 0 | -1 |
| Implementation ease | 0 | 0 | 0 |
| Initial implementation cost | -2 | 1 | 0 |
| Total   | ? |  ? | ? |

### Consequences

What changes as a result of this decision.
