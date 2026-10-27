---
id: ADR-021
title: Layered memory validation — validate, structural-opt-in, and exempt scopes
status: proposed
date: 2026-10-26
scope: architecture/adr — a design decision with rationale and consequences for the memory gate, not cases/ (no single failure plus fix to narrate) and not claims/ (not an atomic sourced fact)
L0: "ADR-021: memory gate tiers — validate scopes fail on errors; structural namespaces opt in by declaring type; machine-written or externally copied scopes are counted only; warnings exit 0, --strict promotes."
---

# ADR-021: Layered memory validation — validate, structural-opt-in, and exempt scopes

## Context

- One flat rule set ran over every file in the memory store. It produced 361 issues and exit 1, and the exit meant nothing: the same rules fired on gateway-written files, fetched caches, and hand-authored typed memories, so no operator could separate a real defect from a shape the producer owns.
- The store is populated by different writers. Some namespaces are authored deliberately; others are written by tools (cache fetches, gateway bookkeeping, browser automation), copied verbatim from external sources (researches synthesis, private notes, evals fixtures), or generated as navigation indexes. A single severity scale cannot serve both.
- Path, not content, is the only stable signal of which writer owns a file, so the policy classifies by path prefix and keeps the prefix tables as data rather than conditionals.

## Decision

Three tiers, assigned by path in `scope_tier`; an `*/about.md` is classified before the prefix tables, so an about beneath an exempt prefix still validates.

| Tier | Namespaces | Behaviour |
|---|---|---|
| VALIDATE | `profile/`, `preferences/`, `entities/`, `events/`, `cases/`, `claims/`, `experiences/`, `trajectories/`, `architecture/adr/`, every `*/about.md` | full rule set as hard failures; the only tier that can fail the gate |
| EXEMPT | `cache/`, `researches/`, `serena/`, `private/`, `browser-automation/`, `evals/`, `tooling/` | findings counted and skipped |
| STRUCTURAL | every other namespace | a file opts into validation by declaring `type:` in frontmatter; untyped files are only counted, and structural errors are demoted to warnings |

Exemption is a statement about ownership, not a claim that the files are correct. These scopes are machine-written or copied from outside: a frontmatter fix there is overwritten by the next fetch or gateway write, so hand-editing buys nothing durable and hides producer drift instead of exposing it. What those files must preserve is fidelity to their producer or source, and the gate cannot check that from the store. Counting them keeps them visible in the summary without turning another writer's shape into this repo's failure.

A file in a structural namespace (for example `harness/`, `serena/` siblings outside the exempt list, or any new domain) is not forced into a type. Declaring `type:` is an explicit opt-in: the author asserts the file is a memory this repo governs, and from then on it is held to the memory rules, at warning severity. That keeps new domains cheap to start and honest when they mature.

Frontmatter detection is anchored at file start: the pattern requires `---` on the first line and a closing `---` line, so a `---` in body prose, a table separator, or a horizontal rule never opens frontmatter. Anchor-anywhere matching was the failure mode that let body content masquerade as metadata.

The ADR family is exempt from the typed `type`/`L0` rule. An ADR identifies itself by an `ADR-<n>` `id` whose file stem begins with that id (`stem == id` or `stem.startswith(id + "-")`), so `ADR-021-layered-...` validates while a mismatched number, or the same form outside `architecture/adr/`, still warns. Required family keys are title, status (`proposed`/`accepted`/`superseded`), and date; `scope` is optional. ADRs are decision records, not typed knowledge, so demanding a typed scope would force a false classification.

Severity follows the tier: only VALIDATE-scope fatals exit 1. Warnings exit 0, because a corpus that fails on warnings is a corpus nobody can keep green; `--strict` promotes every warning to exit 1 for a caller that wants a zero-tolerance run. `just agent_utils::validate-memories` runs every pass even when an earlier one fails.

## Consequences

- Measured outcome: before the redesign, 361 flat issues and exit 1. After, `0 errors, 11 warnings, 20 skipped` and exit 0, with 38 validator tests covering tier assignment, the frontmatter anchor, the ADR id rule, severity demotion, and `--strict`.
- Green now means "no defect in a scope this repo owns", and the 11 remaining warnings are the actionable backlog rather than noise.
- A new namespace starts structural by default; it must be added to `EXEMPT_PREFIXES` if a producer owns it, or to `VALIDATE_PREFIXES` when the repo starts authoring it — otherwise its defects never fail the gate.
- Exemption must be re-examined when a scope changes writer: the tier follows the path, so a scope whose producer is replaced keeps the old tier until the table changes.

## Alternatives considered

- Keep one flat rule set with a growing ignore list: rejected — the ignore list is unreadable and each new namespace re-opens the same argument.
- Fix every exempt file to satisfy the rules: rejected — the writes are overwritten, so the work is not durable.
- Make warnings fail the gate: rejected — it reproduces the original exit-1-everything signal.
