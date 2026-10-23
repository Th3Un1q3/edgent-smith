---
name: general-delivery
description: >
  Default method pack for a worker whose deliverable is not software: research,
  analysis, planning, writing, operations, data gathering, review. Turns a vague
  request into a checkable contract, fixes a proof-of-done artifact per task
  type, holds evidence over assertion in prose, caps questions, and closes the
  report. Load when no domain pack matches. Software changes load
  software-engineering; skill authoring loads harness-management.
license: MIT
compatibility: Universal
metadata:
  version: "1.0.0"
  delta: >
    1.0.0 — extracted the non-code half from the rug-swe.md agent definition when that agent became a general worker and
    generalized the prompt: contract from a vague request, the proof-of-done
    artifact per task type, evidence over assertion, the gap cap, report fields
    for prose deliverables, and the route out to a domain pack the slot did not
    load.
  author: edgent-smith team
---

# General Delivery

Load when the deliverable is not software: research, analysis, planning, writing, operations, data gathering, or review. This pack supplies method only. The resident core owns the contract block, the call budget, the phases, and the report block — fill them here, do not re-describe them.

## Task Routing Table

One file, no companions; every section is reachable here.

| I want to... | Section |
|---|---|
| Turn a vague request into acceptance criteria | [Contract From a Vague Request](#contract-from-a-vague-request) |
| Decide what proves a non-code deliverable | [Proof of Done](#proof-of-done) |
| Keep prose and analysis evidence-backed | [Evidence Over Assertion](#evidence-over-assertion) |
| Decide whether to ask, assume, or block | [Gap Interrogation](#gap-interrogation) |
| Close with the report fields | [Report](#report) |
| Handle a task that needs a pack I did not load | [Missing Domain Pack](#missing-domain-pack) |
| Refuse a failure habit | [Anti-Patterns](#anti-patterns) |

## Contract From a Vague Request

The request arrives as an intention; the contract states a deliverable. Convert it in four moves before the first call.

1. **Task** — name a thing that can exist when you stop: a file, a message, a decision, a changed state. "Look into X" is not a task; "a two-page note stating why X stopped, at path P" is.
2. **Scope** — two lists: inputs you will read or run, and items explicitly out. Out-of-scope items are named so the requester can see the boundary, not so you can silently skip work inside it.
3. **Acceptance** — two to five criteria. Each must be decidable by a reader who was not present, from the artifact alone. Rewrite every unfalsifiable adjective into a check:

| Vague word | Replace with |
|---|---|
| comprehensive | "covers every X listed in source Y" |
| brief | "at most N words" |
| actionable | "each recommendation names an owner and a first step" |
| accurate | "each figure traces to a cited source, and the two sources agree" |

4. **Evidence bar** — one named check per criterion. Name the file and its section, the command and its expected output, the source set and its size, or the read-back that proves a state changed. A criterion with no possible check is not a criterion; cut it or block.

Carry `assume:` for any fact you supplied because the input did not, and keep it short enough to reread every few calls. An assumption that would change scope is a gap, not an assumption.

Worked conversion:

```text
request:  "Look into why the onboarding emails stopped."
task:     Note at notes/onboarding-email-halt.md naming the first failed send and one supported cause.
scope:    in — provider send log for 2026-09-01..2026-09-21, provider status entries, sender config history.
          out — fixing the sender, reviewing email copy, contacting recipients.
acceptance: first failing send named with timestamp.
            cause supported by two independent sources.
            one check stated that would falsify the cause.
evidence:  log excerpt with the timestamp; dated status entry; config line before and after the change.
assume:    the provider export is the complete send log; no application-side queue log was supplied.
```

When the requester supplies no path and no writable location, the artifact is the delivered text; cite it as `reply:§Proof of Done` and hold every claim to the same tests below.

## Proof of Done

Pick the proof form the deliverable admits. Name it in the contract and produce it in the task; a check named after the work is written is a rationalization, not proof.

| Deliverable | Proof artifact | Fails when |
|---|---|---|
| Written artifact (note, spec, plan, release text) | A file at a stated path the requester can open, or the reply body with its section cited; every acceptance criterion maps to a heading | The artifact exists only in the summary of it |
| Research or review finding | Cited source set: one row per claim — claim, source, locator (URL with access date, file with line, document with section), quote or paraphrase marked | A claim has no locator, or a paraphrase is presented as a quote |
| Analysis or data gathering | The query or command, exactly as run, with its observed output and the row or record count | Numbers appear with no run behind them, or the run is described instead of shown |
| Operations change | Before and after read-back of the same observable state, with the command used for each | "It should be applied now" with no read-back |
| Plan or recommendation set | Each item with an owner, a first step, and the check that shows it worked; dependencies and the first irreversible step marked | Items are verbs with no acceptance |

Re-read the artifact before claiming done: open the file, read the section you cited, confirm the criterion is visible there. Quoting your own intention to write it is not verification.

## Evidence Over Assertion

Prose has the same evidence standard as code: every claim either points at something locatable or is labelled as judgement.

- **Label the claim type.** Mark each load-bearing sentence as observed (you saw it this turn), derived (follows from observations, with the step), or recommended (your judgement). Unlabelled prose reads as fact.
- **Preserve the original string.** Quote the log line, error, or sentence you rely on, then interpret it in a separate sentence. A paraphrase of a load-bearing string is a defect: it hides what the source said.
- **Count, do not gesture.** "Widespread" is not evidence. Give the count and the denominator, or write "data not available" and name what would supply it.
- **Disclose the sample.** State what you read, what you did not, and how you chose. Ten files chosen by relevance cannot support "the codebase does X"; say "in the ten files I read, chosen because…".
- **Date time-sensitive facts.** Prices, versions, statuses, and policies carry an access date; a fact without one is a claim about the past.
- **Separate source claim from inference.** Two paragraphs or two columns: what the source states, then what you conclude. A conclusion that needs a missing source is a gap, not a finding.
- **Keep a finding ledger during review or analysis.** One row per finding: location, what is wrong, severity, evidence locator. The ledger becomes the deliverable; prose that summarizes it must not add findings the ledger lacks.
- **Report the counter-evidence you met.** A source that contradicts your conclusion is named in the artifact with how you resolved it. Omitting it makes the artifact unusable to the next reader.

## Gap Interrogation

Gather first. Most gaps close by reading one more input; a question spent on something a permitted source answers is waste and an admission that discovery stopped early.

Ask at most **two** questions per task, batched into one exchange, at one point: after discovery, before producing. Never ask, produce, then ask again.

A question is worth spending only when all four hold:

1. **It changes the artifact**, not its wording or order.
2. **No permitted source settles it** — you checked the supplied inputs first.
3. **The readings diverge materially** — two answers would produce different deliverables, not different phrasing.
4. **It is cheap for the requester** — one fact or one choice among options you can name, not a design you are delegating back.

Otherwise record `assume:` with its basis and continue. When `question` is denied in the harness, the question becomes either an assumption (choose the reading with more evidence and say which) or a `gap:` if a wrong choice cannot be detected later.

Block rather than ask when the deliverable needs authority you do not have: a destructive or irreversible action (delete, send, publish, spend, grant access), an input only the requester holds, or two readings that need different artifacts and neither is checkable afterwards.

Never ask what the request already states, what house style settles, what one call reveals, or a question whose default you could state and defend.

## Report

Close every task with the resident block; for a non-code deliverable fill it as follows.

- `outcome` — `done` only when every criterion has an artifact or observed output that exists this turn.
- `evidence` — one line per criterion: the path and heading, the command with its output, or the source set and its size. Name the check, not the effort.
- `residual risk` — unverified claims, undisclosed sample limits, assumptions still standing, single-source facts, time-sensitivity, and any criterion you could not check because the reserve ran out.
- `spend` — calls used against the limit.

A `done` with a criterion resting on "as described above" fails: the evidence line must point at something a reader can open or rerun. `partial` names the unchecked criteria here, not in passing prose.

## Missing Domain Pack

A task can turn out to be another domain mid-flight. Recognise the switch by the verb, not the topic: "add a retry" is software; "draft the release note" is not; "write a new skill" is skill authoring.

- **Load it now** if the harness permits and budget allows. One call, then restart acceptance criteria for the new domain, and record both packs in `skill_slot`.
- **Do not improvise the missing method.** A remembered test-first or diff rule is not the pack; a partly recalled method produces confident wrong work.
- **When it cannot load** (absent, unreadable, denied, or no budget left), record it in `gap:` and split the task: finish the part `general-delivery` genuinely covers, and report `outcome: partial` naming the deliverable the missing pack owns. If the whole deliverable needs that pack, report `outcome: blocked`.
- **Never relabel.** Presenting default-pack work as a domain deliverable, or calling a plan a design, is the failure this rule exists to prevent.

## Anti-Patterns

| Never | Do instead |
|---|---|
| Present an assertion, impression, or summary of the inputs as the deliverable. | Produce a proof artifact from the table and point at it. |
| Read broadly to postpone producing. | Cap discovery at its phase share; when the answer is still missing, change strategy or state the gap. |
| Answer the easy adjacent question. | Restate the requested deliverable in the contract and check the artifact against it. |
| Invent a citation, a URL, a figure, or a quote. | Cite what you opened; where none exists, write "data not available" and name the source that would fill it. |
| Pad to reach an implied length, or compress past the acceptance criteria. | Hit the stated length and every criterion; cut anything that does not serve a criterion. |
| Deliver a plan or recommendation with no verification step. | Add the check per item, or mark the item unverifiable. |
| Call it done on intent, draft status, or "should be" language. | Re-read the artifact and quote the line that satisfies each criterion. |
| Ask a question whose answer was already supplied or is one call away. | Assume with a stated basis, or look it up. |
| Re-read the same source to feel certain. | Name the remaining uncertainty under `residual risk`. |
| Perform a destructive or outward-facing action to unblock yourself. | Stop and report it as a gap needing authority. |
