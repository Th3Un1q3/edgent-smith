---
title: ADR best practices — structure, status, and review discipline
description: Practitioner sources on ADR structure, status lifecycle, scoring, and review failure modes, used to shape ADR-010's record format and its confirmation section.
tags: [adr, best-practices, documentation, review]
---

# ADR/EDR Best Practices for a Harness Mechanism Decision

A decision record earns its cost when a reviewer can reconstruct the forces, reject the alternatives for stated reasons, and verify the chosen behavior. A record that only announces a choice fails all three tests.

## 1. Format landscape

| Format | Shape | Strength | Cost | Use when |
|---|---|---|---|---|
| Nygard ADR | Title, Context, Decision, Status, Consequences; 1–2 pages | Cheapest complete record; forces and consequences stay visible | No explicit options or drivers section | Most decisions, including harness mechanisms |
| MADR full | Context and Problem Statement, Decision Drivers, Considered Options, Decision Outcome, Consequences, Confirmation, Pros and Cons, More Information | Makes alternatives and verification first-class | Longer; risks option theatre if drivers are weak | Contested decisions with several viable designs |
| MADR minimal | Context and Problem Statement, Considered Options, Decision Outcome | Keeps the decision and alternatives, drops ceremony | No explicit consequences or confirmation | Small, reversible choices |
| Y-statement | "In the context of X, facing Y, we decided Z, to achieve W, accepting V" | One sentence; useful in indexes and decision logs | Cannot carry failure modes, migration, or evidence | Index entries, not mechanism decisions |
| Engineering Decision Record (EDR) | ADR mechanics applied to engineering practice and tooling | Names the audience: maintainers of the development system | No fixed schema; quality depends on the chosen ADR template | Harness, CI, tooling, and process decisions |
| RFC / design document | Motivation, guide-level and reference-level design, drawbacks, alternatives, prior art, unresolved questions | Exposes design detail and invites review before commitment | Heavy; mixes design exploration with the decision | Novel, cross-team, or high-blast-radius mechanisms |

Nygard defines an ADR as a short text record for "architecturally significant" decisions: those affecting structure, non-functional characteristics, dependencies, interfaces, or construction techniques ([Nygard 2011](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)). A harness instruction-injection mechanism qualifies: it changes the agent's effective prompt, the tool contract, and the context budget.

MADR adds decision drivers, per-option pros and cons, and a confirmation section that states how compliance is verified ([MADR](https://adr.github.io/madr/), [adr/madr](https://github.com/adr/madr)). The confirmation section matters more than the scoring table: it turns the record into something a test can enforce.

The EDR label is a scoping convention, not a different document format. DDSE's artefact taxonomy separates architectural decisions (system structure) from engineering decisions (development practices and tooling) ([DDSE Foundation](https://deepwiki.com/ddse-foundation/ddse-foundation)). Use ADR mechanics, state the engineering scope in the title, and do not invent a second schema.

## 2. Structure that survives review

### Title

Name the decision, not the problem. "Inject workflow instructions when the workflow tool is exposed" beats "Workflow tool context problem". One decision per record; split choices that can change independently ([bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns)).

### Status and metadata

Record status (`proposed`, `accepted`, `rejected`, `deprecated`, `superseded`), date, owner, reviewers, and links to superseded or related records. Nygard allows `proposed` before agreement and `superseded` with a pointer to the replacement. AWS adds an immutable change history and a named owner per change ([AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/best-practices.html)). GDS treats the pull request as the proposed state, then records acceptance and implementation before any supersession ([GDS Way](https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html)).

### Context

State the forces: the current mechanism, the observed failure, constraints, and the qualities at stake. Keep the language value-neutral; describe facts, not a preferred solution. Nygard names technological, political, social, and project-local forces, and notes that they are usually in tension ([Nygard 2011](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).

Bound the section. One page or roughly 300 words, with links to background instead of restating it. Nygard's argument for small records is operational: large documents are never kept up to date and nobody reads them. An unbounded context dump buries the decision and makes review expensive.

For this decision, the context must name the two current containers and their failure modes: agent-definition prose is not inherited by other agents, and tool descriptions bloat context and are weakly obeyed. It must also name the harness capability that makes injection possible, and whether that capability is detected or assumed.

### Decision drivers

List the criteria before the options. Typical drivers for a harness mechanism:

- Correctness: instructions apply whenever the tool is exposed, and only then.
- Context efficiency: bounded bytes, no duplicate injection.
- Maintainability: one text source, no copy in agent definitions.
- Portability: graceful behavior across harness versions and other harnesses.
- Observability: a session can prove whether injection happened.
- Reversibility: a flag restores the previous behavior.
- Security: injection remains harness-controlled and cannot be influenced by tool output.

Ozimerr's most common defect is criteria reverse-engineered from the preferred option ([Zimmermann 2026](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html)). Write drivers that could disqualify the author's favourite.

### Considered options

Record at least two genuine alternatives, including the status quo or "do nothing". Ozimmer states the rule directly: "A decision that does not identify alternatives and chooses one of them is not a decision." For this decision, the realistic set is:

1. Keep instructions in the agent definition.
2. Keep them in the tool description.
3. Inject them from the harness when the tool is present.
4. Inject from a shared prompt fragment loaded by every agent that receives the tool.
5. Do nothing and accept inconsistent behavior.

Option 4 is not a variation of option 3; it has a different owner, failure mode, and migration path. Do not collapse it.

### Decision outcome

State the choice in active voice: "We will ...". Name the trigger precisely. "The workflow tool is available" needs a definition: registered in the session toolset at startup, callable by name, or listed in the rendered tool prompt. Each definition produces different behavior during session resume, compaction, and permission changes.

State scope and non-goals. Say which agents, harnesses, and tool variants the decision covers, and which it does not. Link the decision to the drivers rather than restating the option table.

### Consequences

List positive, negative, and neutral consequences. Nygard requires all three; a record with only benefits is marketing, not a decision record. Include operational and maintenance consequences: token cost per session, a new text surface to version, a new failure mode when injection fails, and the support burden of two instruction sources during migration.

Ozimerr adds two checks: state negative consequences, and identify consequences for stakeholders other than architects and developers ([Zimmermann 2026](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html)). For harness work, the affected parties include agent authors, session users, and maintainers of other harnesses.

### Confirmation

Say how a reviewer or a test can prove the decision holds. MADR's confirmation element is the right container ([MADR](https://adr.github.io/madr/)). For this mechanism:

- A session with the workflow tool contains the injected block exactly once.
- A session without the tool contains no injected block.
- The rendered block matches a versioned golden fixture.
- The injection event appears in the session trace with source, version, and byte count.
- Disabling the flag restores the previous prompt.

If a criterion cannot be checked, it is aspiration, not a decision requirement.

## 3. Presenting options and trade-offs

- Put drivers before options. A reader must be able to disagree with a criterion, not just with the verdict.
- Give every option pros, cons, and neutral points, each with a "because" clause. MADR's `Good, because ...` / `Bad, because ...` form forces a reason ([MADR](https://adr.github.io/madr/)).
- Justify rejections as carefully as the selection. Ozimmer notes that runner-up rejection reasons are often as interesting as the winning rationale.
- Include the status quo. A decision that cannot beat "keep the current text" has not made its case.
- Score only after declaring criteria and weights, and disclose both. A score cannot override a hard constraint; state constraints separately and let them disqualify options.
- Evaluate operational dimensions, not just elegance: failure behavior, debuggability, token cost, version skew, and who carries the maintenance.
- Keep exploration out of the decision record when it grows. A design document can hold the full option analysis; the ADR records the choice and links to it ([bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns)).

## 4. Implementability and reviewability

A record is implementable when an engineer can derive the change without asking the author, and reviewable when a reviewer can falsify it.

- One decision per record. Independent lifecycles belong in separate records; tightly coupled corollaries can stay together ([bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns)).
- Separate the decision from the implementation plan. The ADR says what will be true and why; the task list, PR, and rollout plan say how and when. "Docs explain how. ADRs explain why." ([bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns)).
- State observable acceptance. Confirmation, tests, metrics, or gates belong in the record.
- Make the decision normative and bounded. "We will inject X when Y" is testable; "we should improve instructions" is not.
- Record the revisit trigger. A harness version bump, a new tool-exposure mechanism, or a token-budget breach should reopen the decision.
- Keep accepted records immutable. Supersede with a new record and mark the old one. AWS treats approval as the immutability boundary; bool.dev compares it to an append-only log ([AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/best-practices.html), [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns)).
- Review with the disciplines that carry the consequences. GDS recommends reviewers from development, reliability, security, and affected teams, and uses the pull request as the review surface ([GDS Way](https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html)).
- Keep the template stable. Inconsistent section order slows every future reader (Ozimerr, issue 9).

RFC-style records add two useful review devices for a mechanism: a guide-level explanation that shows how an agent author experiences the change, and a reference-level explanation that covers corner cases, interactions, and implementation clarity ([Rust RFC template](https://github.com/rust-lang/rfcs/blob/master/0000-template.md)). Use them as appendices if the ADR grows past two pages.

## 5. Anti-patterns

| Anti-pattern | Symptom | Fix | Source |
|---|---|---|---|
| Retrospective rationalization | Record written after implementation; context reconstructed; alternatives remembered selectively | Write before or during the decision; mark genuinely retrospective records as such and avoid inventing alternatives | [catio.tech](https://www.catio.tech/blog/architecture-decision-record) |
| Missing alternatives | Only the chosen option appears | At least two options plus status quo; state rejection reasons | [Ozimerr](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html) |
| Reverse-engineered criteria | Drivers match the preferred option's strengths | Write drivers from requirements and qualities before evaluating options | [Ozimerr](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html) |
| Decision repeats the title | Outcome section adds no rationale | Explain selection against drivers and alternatives | [Ozimerr](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html) |
| Marketing consequences | Only benefits; no costs, risks, or stakeholder impact | List positive, negative, neutral; include operators and maintainers | [Nygard](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions), [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns) |
| Unbounded context | Pages of history; decision buried | One page, link out, keep only forces that change the choice | [Nygard](https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions) |
| Decision as implementation detail | ADR contains code-level how-to or a task list | Keep the decision and constraints; link the implementation plan | [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns) |
| ADR as architecture overview | Record describes the whole system | Keep the snapshot of one decision; use a design doc or architecture view for the system | [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns) |
| Many decisions in one record | Database, broker, and auth in one file | Split by independent lifecycle | [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns) |
| Editing accepted records | Old rationale overwritten | Supersede; keep history | [AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/best-practices.html), [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns) |
| Inconsistent template | Sections reordered or renamed per author | Fix the template; validate in review | [Ozimerr](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html) |
| Unchecked AI output | Fluent record with generic pros and cons, no local constraints | Verify every claim; the author owns the trade-off | [Ozimerr](https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html), [bool.dev](https://bool.dev/blog/detail/10-adr-antipatterns) |

## 6. Developer-tooling and agent-harness specifics

A harness decision differs from a service architecture decision in four ways: the contract is a prompt and tool surface, behavior varies by harness version and session lifecycle, failures are often silent, and the change ships to every session at once.

### Capability contract

Define availability semantically, not by version string. State whether the trigger is tool registration, tool reachability, or prompt exposure, and what happens when the tool is disabled mid-session or restored after compaction. Prefer capability detection over version sniffing; version checks rot when harnesses patch behavior.

### Observability

Emit a structured event for every injection attempt: session identifier, harness version, tool-present boolean, injected boolean, source, payload version, byte or token count, duration, and error class. Make the event queryable, not just logged. A harness is improvable only when each failure becomes data; Datadog's harness-first account makes observability the verification loop rather than an afterthought ([Datadog](https://www.datadoghq.com/blog/ai/harness-first-agents/)).

Add a debug switch that dumps the rendered injection. Without it, a prompt regression has no inspectable artifact.

### Failure modes

| Condition | Required behavior | Detection |
|---|---|---|
| Tool absent | No injection; session proceeds normally | `tool_present=false` event |
| Injection renderer errors | Fail open; session proceeds without the block; emit error | Error event with stage |
| Injection applied twice | Idempotent; second attempt becomes a no-op | Duplicate-injection counter |
| Tool removed mid-session | Stop injecting on the next turn; do not leave stale text in the prompt | Toolset-change test |
| Context budget exceeded | Truncate by a declared rule or skip injection; never emit partial instructions | Budget-exceeded event |
| Conflicting agent-definition text | Precedence rule wins; conflicting text is removed in the same change | Conflict fixture |
| Cross-harness duplicate | One owner per harness; shared text has a single source | Session trace review |

State in the ADR whether failure is open or closed. "Fail open" preserves the session but silently changes agent behavior; "fail closed" blocks work. Choose deliberately and test it.

### Versioning

Version the instruction payload independently from the harness. Record a compatibility range, a changelog entry per behavior change, and the payload version in the injection event. Keep the text in one owned source; do not fork it per agent or per harness. If the harness exposes an injection API, treat its shape as a contract: pin behavior with a fixture and re-verify on harness upgrades.

### Migration

Use a dual-run window: keep the existing agent-definition text as a fallback, enable injection behind a flag, and compare sessions. Define removal criteria in advance, for example "after 20 sessions show exactly one injection and no missing-tool sessions". Keep rollback to a flag flip. A big-bang deletion of the old text removes the only fallback before the new path has evidence. Incremental replacement with a reversible seam follows the strangler pattern ([Fowler](https://martinfowler.com/bliki/StranglerFigApplication.html)).

### Security and trust

Treat the instruction source as harness configuration, not user content. Tool output must never be able to append to the injected block. Keep secrets out of the payload, record provenance, and apply the same review gate to text changes as to code changes. Prompt text is executable behavior.

### Cost

Set a byte or token cap per session and measure it. State what happens at the cap. Unbounded injection trades one context problem for another.

## 7. Recommended record shape for the workflow-injection decision

1. **Title**: Inject workflow instructions when the workflow tool is exposed.
2. **Status/metadata**: proposed, date, owner, reviewers, supersedes/related.
3. **Context**: current agent-definition text and tool description; why each fails; the harness injection precedent; constraints.
4. **Decision drivers**: correctness, context cost, single source, portability, observability, reversibility, security.
5. **Considered options**: current agent text; current tool description; harness injection; shared prompt fragment; do nothing. Pros, cons, neutral, rejection reason.
6. **Decision outcome**: trigger definition; injected content and owner; precedence; scope and non-goals.
7. **Failure behavior**: absent tool, render error, duplicate, mid-session change, budget breach, conflict.
8. **Observability**: event schema, debug switch, query.
9. **Versioning and compatibility**: payload version, harness range, capability detection.
10. **Migration and rollback**: dual-run, flag, removal criteria.
11. **Consequences**: positive, negative, neutral; token cost; maintainer load; cross-harness impact.
12. **Confirmation**: fixture tests, injection-count test, absence test, trace assertion.
13. **Revisit triggers**: harness API change, budget breach, cross-harness adoption.

## 8. Checklist the eventual ADR must satisfy

### Framing

- [ ] Title names one decision, not a problem or a project.
- [ ] Status, date, owner, and reviewers are present.
- [ ] Scope states covered agents, harnesses, and tool variants, plus explicit non-goals.
- [ ] Context is bounded to about one page or 300 words and links to background.
- [ ] Context states the current mechanism and the observed failure, not a preferred solution.
- [ ] Decision drivers are explicit, independent of the options, and could disqualify the author's preference.
- [ ] Related and superseded records are linked.

### Options

- [ ] At least two genuine alternatives, including the status quo or "do nothing".
- [ ] Every option has pros, cons, and neutral points with "because" clauses.
- [ ] Rejection reasons are as specific as the selection reason.
- [ ] Criteria and weights are declared before scoring; hard constraints are separate from preferences.
- [ ] Operational dimensions appear: failure behavior, debuggability, token cost, version skew, maintenance owner.

### Decision

- [ ] The outcome is stated in active voice as "We will ...".
- [ ] The trigger condition is defined precisely enough to test.
- [ ] The instruction source, owner, and precedence order are stated.
- [ ] Failure behavior is explicit for absent tool, render error, duplicate injection, mid-session change, budget breach, and conflicting text.
- [ ] Observability is specified: event name, fields, destination, and how to query it.
- [ ] Trust boundary is stated: injection is harness-controlled and unaffected by tool output.
- [ ] Capability detection replaces version sniffing; supported harness range is declared.
- [ ] The payload has an independent version and a changelog rule.
- [ ] Migration uses dual-run, a flag, and pre-declared removal criteria; rollback is a flag flip.
- [ ] A byte or token cap exists, with a defined behavior at the cap.

### Consequences

- [ ] Positive, negative, and neutral consequences are listed.
- [ ] Technical, operational, maintainer, and session-user impacts are covered.
- [ ] Reversibility and blast radius are stated.
- [ ] Follow-up work has an owner; no unowned TODO.

### Confirmation and review

- [ ] A test proves injection occurs exactly once when the tool is present.
- [ ] A test proves no injection occurs when the tool is absent.
- [ ] A golden fixture pins the rendered content and its version.
- [ ] A session trace or log sample proves the observability event fires.
- [ ] A flag-off test proves rollback restores the previous behavior.
- [ ] Revisit triggers are named.
- [ ] A reviewer can point to a criterion they disagree with and a test that would settle it.

### Hygiene

- [ ] The record uses one template, in one section order.
- [ ] The record stays within two pages excluding appendices.
- [ ] Accepted records are immutable; changes arrive as a superseding record.
- [ ] The record explains why, not how; implementation links replace code dumps and task lists.
- [ ] Alternatives were not retrofitted after the fact.
- [ ] Every AI-drafted claim was checked against the repository and the harness.

## 9. Sources

- Michael Nygard, "Documenting Architecture Decisions" (2011): https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- ADR community index: https://adr.github.io/
- MADR template: https://adr.github.io/madr/ and https://github.com/adr/madr
- Olaf Zimmermann, "Ten Common Mistakes in Architectural Decision Records" (2026): https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html
- bool.dev, "10 ADR Anti-Patterns and ADR Best Practices" (2026): https://bool.dev/blog/detail/10-adr-antipatterns
- AWS Prescriptive Guidance, "Best practices for using architectural decision records": https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/best-practices.html
- AWS Architecture Blog, "Master architecture decision records": https://aws.amazon.com/blogs/architecture/master-architecture-decision-records-adrs-best-practices-for-effective-decision-making/
- GDS Way, "Documenting architecture decisions": https://gds-way.digital.cabinet-office.gov.uk/standards/architecture-decisions.html
- Rust RFC template: https://github.com/rust-lang/rfcs/blob/master/0000-template.md
- catio.tech, "Architecture Decision Records (ADRs): The 2026 Guide": https://www.catio.tech/blog/architecture-decision-record
- DDSE Foundation artefact taxonomy (ADR/EDR/IDR): https://deepwiki.com/ddse-foundation/ddse-foundation
- Martin Fowler, "ArchitectureDecisionRecord": https://martinfowler.com/bliki/ArchitectureDecisionRecord.html
- Martin Fowler, "StranglerFigApplication": https://martinfowler.com/bliki/StranglerFigApplication.html
- Datadog, "Closing the verification loop: Observability-driven harness-first agents": https://www.datadoghq.com/blog/ai/harness-first-agents/
- Google design docs (exploration vs decision record): https://www.industrialempathy.com/posts/design-docs-at-google/