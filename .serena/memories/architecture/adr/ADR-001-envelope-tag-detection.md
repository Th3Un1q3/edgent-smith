---
id: ADR-001
title: Envelope tag detection in skills-loader: precise regex vs XML parser
status: accepted
date: 2026-08-06
scope: .opencode/plugins skills-loader envelope mechanism — detecting plugin-generated <envelope id="<uuid>" description="..."/> tags in agent-generated text and unwrapping them
---

# ADR-001: Envelope tag detection in skills-loader: precise regex vs XML parser

## Decision

One-time envelope implemented as an XML tag and parsed with a regex.

## Considerations

### Context

skills-loader injects a tiny self-closing `<envelope id="<uuid>" description="..."/>` tag into task prompts (payload stored in-memory) and a `chat.message` hook must detect and unwrap it. Initial substring-based detection failed LIVE (prose examples in prompts matched the guard/regex — see `mem:troubleshooting/opencode-plugin-live-diagnosis`), fixed with a UUID-precise regex. Question: is a general XML parser a better approach? Empirical research (`mem:researches/xml-parsing-skills-loader`) tested parsers against realistic agent prose.

### Options considered

#### Option A: Precise regex (UUID-gated, self-closing-shape pattern; current implementation)
Pros:
- Zero dependencies; no entity-expansion/DoS surface; precise on the exact shape the plugin emits; regression-tested
Cons:
- Tied to the emitted tag shape (mitigated by canonical emission + full attribute escaping `& " ' >`); a regex, not a general XML facility

#### Option B: General XML parser (saxes / fast-xml-parser / @xmldom/xmldom / htmlparser2)
Pros:
- "Standard" XML handling; could parse attribute values generically
Cons:
- Whole-document semantics — strict parsers crash on prompts (markdown/code fences/unbalanced tags), document parsers silently mangle them; entity-expansion security advisories; still needs regex/scanner pre-extraction; adds dependencies

#### Option C: Non-XML delimiter (e.g., unique marker line `<<<ENVELOPE:<uuid>>>>`)
Pros:
- Simplest possible; no XML semantics; no escaping concerns
Cons:
- Violates the operator's constraint of an XML-ish tag shape; less self-describing to the model; diverges from the `<task_skills>` XML convention

#### Option D: Hand-rolled single-tag scanner (~15 lines)
Pros:
- Robust to any attribute order/formatting; dependency-free
Cons:
- More code than needed given canonical emission; must be written + tested

### Scoring

Criteria (each scored -2 to +2):
- Maintainability — ease of understanding and evolving over time
- Flexibility — adaptability to future requirements
- Implementation ease — straightforwardness with the current stack
- Initial implementation cost — effort to build (higher score = cheaper)

| Criteria | A: Precise regex | B: XML parser | C: Non-XML delimiter | D: Hand-rolled scanner |
|---|---|---|---|---|
| Maintainability | +2 | -1 | +1 | +1 |
| Flexibility | +1 | -1 | +1 | +2 |
| Implementation ease | +2 | -1 | +2 | +1 |
| Initial implementation cost | +2 | -1 | +2 | 0 |
| Total | +7 | -4 | +6 | +4 |

### Consequences

Detection stays regex-based; emission stays canonical (id first) with full attribute escaping; a real XML parser is deferred — to be revisited ONLY if we ever need to structurally validate/extract the unwrapped `<task_skills>` payload (well-formed by construction), not for tag detection.
