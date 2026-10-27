---
name: comments
description: "Comment discipline for code, config, tests, and docs: delete restatement, stale claims, provenance narration, and shadow keys; keep rationale, invariants, contracts, and comments a tool prints as help."
applyTo: "{**/*.{ts,js,py,yml,yaml,md,json,jsonc,sh,html,htm,toml,cfg,ini},**/{justfile,Justfile,Dockerfile,Dockerfile.*},**/.env*}"
---

# Comment discipline

A comment earns its place only when it is true and does a job the code cannot do.

## How to decide

Ask these questions in order before you write or keep a comment.

1. Is it true now? Open the code, config, or test the comment describes and reproduce the claim from the tree. If the claim is false, correct it or delete it in the same change. Never keep a wish. This question is a veto.
2. Does it do a job? A comment must prevent a false belief, prevent wasted work, record a constraint the code cannot express, or serve as documentation that a tool displays. If it does none of these, delete it.
3. Can something else carry the fact? If the adjacent code already states it, delete the comment. If a name, type, test, or interface can carry it, move the fact there and delete the comment. Question 4 gives one exception.
4. Will a tool display the comment? A docstring is the first statement in the body of a Python module, class, or function. Not every docstring is displayed. Check whether a tool actually shows it. Some tools print it as help. `just --list` prints recipe descriptions, Click prints command docstrings in `--help`, and `pytest --fixtures` prints fixture docstrings. If a tool displays the comment, it is documentation and has a job under question 2. The tool needs text at that location, so do not delete it. Rewrite it for the person reading that output. If the text is false, correct it. If it only repeats its name, rewrite it to say why the item exists. Question 4 is an exception to question 3 only; it never excuses a false comment.

For a comment no tool renders, keep it only when it is true, does one of the jobs in question 2, and no name, type, test, or interface can carry the fact.

Question 1 is a veto. Question 2 decides whether a non-rendered comment survives. Question 3 decides whether the fact should move into a name, type, test, or interface. When the fact moves, delete the comment. Question 4 is an exception to question 3: a rendered line stays where the tool reads it, and is rewritten rather than deleted.

## Terms

- Restatement: prose that repeats the adjacent code, name, or type without adding a rule or reason.
- Trap comment: a comment that names a hazard the code cannot express, such as a security, platform, or type-checker failure.
- Documentation job: text a tool prints for a user, such as recipe descriptions, Click help, and fixture docstrings.
- Cleanup rule: the deletion obligation for commented-out code and debug artifacts; apply the rule in `test-driven-development`.
- Debug artifact: a temporary print or logging call left in the source.
- Banner comment: fill characters or a numbered marker whose only content is the label of the section below it.
- Meta-commentary: prose about the file's own comments or identity instead of its subject.
- Bookkeeping marker: a `TODO`, `FIXME`, `TBD`, or `placeholder` that records a task rather than a fact.
- Behavior-changing order: an ordering constraint whose reversal changes runtime behavior.
- Substantive spec: a named section, spec, or issue that carries the rule a comment cites.
- Comment-density target: a ratio or count of comments per file, set outside this file.
- Cast comment: a comment on a type cast that must explain the trap requiring the cast, not the cast syntax.
- Job: one of the reasons listed in question 2.
- Veto: a rule that always applies, whatever the other answers.
- Rendered: displayed by a tool as documentation.
- Carry: store the same information in a name, type, test, or interface.

## Worked example

A useless comment:

```python
# Configuration values
cli_type = DEFAULT_AGENTIC_CLI_TYPE
```

Question 1 passes because the comment is true. Question 2 fails because it prevents no false belief, saves no work, and records no constraint. Question 3 applies because the assignment already names the value, so delete the comment. Question 4 does not apply.

A legitimate comment that records why:

```yaml
# ~/.dsh is the dsh harness home. Instead of an anonymous named volume
# (wiped on rebuild), bind it to the repo's `.dsh/` directory so the
# harness home IS a workdir directory: ...
```

Question 1 passes. Question 2 passes because it records a rejected alternative that a future editor would otherwise repeat. Question 3 answers no because no name or type can carry why a bind mount replaced a named volume. Question 4 does not apply. Keep it.

## Useless commentary

### 1. Restatement, inline and docstring

A restatement repeats in prose what the adjacent code already says.

**What it looks like.** A label sits above the statement it names, or a docstring expands an identifier into a sentence.

```python
# Configuration values
cli_type = DEFAULT_AGENTIC_CLI_TYPE
```

`cli/services/copilot_session.py` has a docstring that repeats its own class: `"""Service to interact with the GitHub Copilot CLI."""`

**Why it is a problem.** The next line already states the fact, and the copy becomes stale while the code stays correct.

**What to do instead.** Delete it. Keep only a rule, unit, or failure mode that the line cannot express.

### 2. Type-system narration

**What it looks like.** A cast is explained for the type checker, a signature is recited as `@param` or `@returns`, or a suppression (a directive, meaning a comment that switches off one checker rule) appears with no rule or reason.

```python
spec.loader.exec_module(mod)  # type: ignore
```

**Why it is a problem.** The signature and the type checker are authoritative. A bare directive hides which rule was waived, so the next reader cannot tell a deliberate exception from debt.

**What to do instead.** Delete the recital. For a suppression, name the rule code (the checker's identifier for the rule, such as `C901`) and the reason, or remove the need for the suppression. A bare `# noqa` in `tests/test_fetch_transcript.py` and `# noqa: C901` with no reason in `agent_utils/scripts/validate_memory_frontmatter.py` both fail this rule.

### 3. Stale counts, inventories, and false claims

**What it looks like.** It looks like a hand-maintained part count, coverage list, before-and-after metric, or a behavior claim the current branch contradicts.

```ts
* One `effect` closure, eight parts: config + lazy per-agent budget resolver,
```

A comment claims a return path the function does not have.

**Why it is a problem.** Nothing validates the number, the next edit invalidates it, and a confident false claim is worse than no comment.

**What to do instead.** Keep the invariant (the condition that must always stay true) and one clause of justification. Move measurements to one authoritative source. Delete a volatile count rather than correcting it; keep a number only when a checker, script, test, or rule reads it, and name that consumer in the comment. When a reader still needs the fact, point at its source of truth: the directory, recipe, catalog, or script. Correct or delete a false claim in the same change.

### 4. Edit and provenance narration

Provenance is the history of where code came from or who changed it.

**What it looks like.** A comment says where code moved from, that it was extracted or migrated, or which process step produced it.

```python
# These were previously defined in evals/runner.py — moved here for central configuration.
```

`tests/test_cli_init.py` prefixes a test docstring with `TDD Test:`, where TDD means test-driven development.

**Why it is a problem.** It answers what the author did, not what must hold. Git and the commit message carry history.

**What to do instead.** Delete it. If parity is a real contract (a behavior another file or test depends on), name the test file and test case that require it. If a plan identifier carries a rule, keep the rule and drop the identifier.

### 5. Duplicated source of truth

A source of truth is the one place where a fact is maintained.

**What it looks like.** The same sentence sits at declaration and use, in twin files (two files that duplicate the same recipe or setting), or in an instruction file and in code.

`noReply?: boolean // when set to true, the message is sent without triggering agent reply` appears twice in `.opencode/plugins/helpers/session-helpers.ts`. `opencode/justfile` repeats recipe descriptions from `.opencode/justfile`, and both files set the same effective working-directory, using different relative strings (`../.opencode` and `.`).

**Why it is a problem.** Copies become stale, and a reader cannot tell which one is authoritative.

**What to do instead.** Keep one home and point at the owner. For recipe docs duplicated across justfiles, choose one file to own the description, keep the copy the tool displays, and delete only a duplicate that no tool displays.

### 6. Commented-out code, shadow keys, and key-label restatement

A shadow key is a commented-out key that duplicates a live key with a different value.

**What it looks like.** It looks like disabled commands, mounts, or keys, a shadow key, or a label that repeats the live key below it.

```yaml
# agent-default-model:
#   provider: local
```

The live `agent-default-model` in `.dsh/settings.yaml` sets `provider: openrouter`. `.devcontainer/setup-dev.sh` keeps an install command commented out: `# codegraph install --target=auto --location=local --yes`.

**Why it is a problem.** Nothing records whether dead code is blocked or pending. A shadow key gives one setting two candidate values. A label adds no unit, allowed value, constraint, or state.

**What to do instead.** Delete it; `test-driven-development` owns the cleanup rule for commented-out code and debug artifacts (temporary print or logging calls left in the source). For a pending decision, keep one line naming the blocker and the tracking issue. For a shadow key or a labeled key, keep only the live key plus any unit, allowed values, external constraint, or behavior-changing order.

### 7. Task, placeholder, and bookkeeping markers

**What it looks like.** It looks like a `TODO` or `FIXME` diary entry, a self-question (a comment that asks a question about the code instead of stating a fact), `TBD`, or a `placeholder` cell.

```yaml
# FIXME: There is a problem that uh this configuration declared in this file is applied to all agents which was not intended. ...
```

`docs/system-overview.md` ships a table cell that reads `Feedback hub (content TBD)`.

**Why it is a problem.** It records a task, not a fact, and carries no owner or acceptance condition.

**What to do instead.** Resolve by changing the design; a renamed helper that hides the blocker does not resolve it. Otherwise state the invariant and the blocker with an issue reference. Omit an empty row until content exists.

### 8. Commentary about commentary

**What it looks like.** It looks like policy prose about the file's own comments, a note that the comments below are justified, or advice to future editors.

```jsonc
// generated/vendor/noise directories only. Every rule override below is
// justified inline; anything not listed stays at the strict default.
```

**Why it is a problem.** The reader has the comments, and prose does not enforce the policy.

**What to do instead.** Delete it and enforce the rule in the linter or config that can check it.

### 9. Self-identifying headers and asset labels

**What it looks like.** A header repeats the path the reader just opened, a banner of dashes, or an asset label (a comment that labels an image or link already named by its tag).

```bash
# scripts/ci.sh — local CI gate runner (13 gates, sequential).
```

In `docs/index.html`, `<!-- Theme used for syntax highlighted code -->` sits above the `monokai.css` link.

**Why it is a problem.** The path and the tag are visible, and fill characters carry no information.

**What to do instead.** Start with the description, drop the path and the fill, and use a real heading or a module split for grouping.

### 10. Test restatement

**What it looks like.** Comments narrate arrange, act, and assert, a docstring repeats the test name, or a `Covers:` line lists cases.

```python
# Create a mock config
```

A test docstring opens with a TDD hardening line and follows it with a `Covers:` block listing each case.

**Why it is a problem.** The test name and body state the case, and step comments rot when the body changes.

**What to do instead.** Name the case in the test name. Comment only tolerance, fixture intent (why a test fixture exists and what state it sets up), or a contract mirrored from production.

### 11. Document self-reference

Self-reference is a comment or sentence about the comment, file, or document itself instead of its subject.

**What it looks like.** It looks like a `This document...` preamble, `In this section...`, a reading-order note, or a map of the document's own parts.

```markdown
This document maps the AI adoption system described in `docs/new-deck.html`.
```

**Why it is a problem.** The reader needs the subject, not the document's self-description. Headings already carry structure, and the narration becomes stale as sections change.

**What to do instead.** Open with the claim or instruction, and let headings carry structure. `writing-style` owns document-level voice.

## Comments that earn their place

Keep a non-rendered comment when it is true today, does one of the jobs in question 2, and no name, type, test, or interface can carry the fact.

- Why and rejected alternative: state the decision and what it replaced.
- Invariant: `.opencode/plugins/tool-limit-reminder.ts`: `Advertised budget must equal the enforced threshold`
- Cross-module contract: a behavior two modules must agree on. `tests/test_long_inputs.py`: `# all numeric scores equal 1.0 (mirrors runner.case_pass_results logic).`
- Security or platform trap: `.devcontainer/setup-dev.sh`: `# .credentials.yaml holds a real OPENCODE_GO_API_KEY: copy it, never print it,`
- Contract for a function, whether public or used only inside its module: `.opencode/plugins/quality-gate-enforcer.ts`: `// Runs one gate and reports whether its status changed. Returns undefined when`
- Non-obvious algorithm: `.opencode/plugins/helpers/workflow-subtask.ts`: `// opening tag at index 0 would loop forever; stop after the first one.`
- Required directive with its reason: `tests/test_cli_fix.py`: `# pragma: no cover - assertion-backed safety net`
- Substantive spec or issue citation: name the section or issue that carries the rule. A bare `# see docs` fails question 2.

### Tool and output exceptions

A tool that prints a comment turns it into user-facing documentation. Keep these comments and write them for the reader of that output. If a rendered line only repeats its own name, rewrite it to say why the item exists; do not delete it, because the tool needs a description. A tool display never excuses a false comment; a weak rendered line is rewritten.

- A `just` recipe `#` line is `just --list` output. Keep it and make it state why the recipe exists, which shell settings are chosen, and what env files load.
- A Click docstring is command help. Keep the user-facing description, examples, and exit behavior.
- A pytest fixture docstring is printed by `--fixtures`. Keep what the fixture provides and when to use it.
- A reveal.js `<aside class="notes">` block is a presenter script (speaker notes embedded in a reveal.js slide), not a code comment.
- `.env.example` comments are the schema for required keys.

## By file type

### Python

- Delete a docstring that restates the name or arguments. Keep units, raised exceptions, side effects, and return shape.
- `# type: ignore` and `# noqa` name the rule and the reason, or they go.
- Delete commented-out code; `test-driven-development` owns that cleanup rule.
- Put a why above a non-obvious branch, not a narration of the branch.

### TypeScript and JavaScript

- Delete JSDoc that recites typed parameters. Document thrown errors, `undefined` returns, and ordering.
- Replace `@ts-ignore` by fixing the type. A comment on a cast should explain the runtime or type-checker trap that requires the cast, not repeat the cast syntax.
- Do not add `eslint-disable` in tests; `plugin-tests-imports` owns that ban.
- Delete banner comments. Split the module when grouping matters.

### YAML, JSON, and JSONC

- Delete key-label comments and commented-out keys.
- Keep units, allowed values, external constraints, and ordering that changes behavior.
- A comment that supplies a second value for a live key is a defect, not an alternative.

### Markdown and docs

- Delete `This document...` preambles, plan steps, provenance, counts, and reading-time tables.
- Cite the source inline and let headings carry structure.
- `writing-style` owns document-level voice.

### Tests

- Let the test name state the case. Delete arrange, act, and assert narration.
- Comment tolerance, fixture intent, or a contract mirrored from production.
- Delete `TDD Test:` prefixes, `Covers:` inventories, and debug markers.

### Shell, justfiles, and containers

- Keep the recipe `#` line as `just --list` output, and make it say why the recipe exists.
- Delete commented commands and header banners.
- Keep trap comments for TLS, proxy, credentials, and mount behavior.

## Ownership

| Pattern | Owner |
|---|---|
| Cleanup of commented-out code and debug artifacts | `test-driven-development` |
| Document-level voice, meta-commentary, and provenance in markdown | `writing-style` |
| Required recipe comments and their `just --list` rendering | `justfiles` |
| `eslint-disable` ban | `plugin-tests-imports` |
| Plugin import conventions | `opencode-plugin-interfaces` |

- Recognize and classify dead code, shadow keys, or duplicated comments in the kinds above; the owner named in the table is responsible for cleanup.
- Do not delete a rendered recipe `#` line; rewrite it for the person reading `just --list`.
- Suppression policy, formatting rules, comment-density targets, and presenter-note content belong to the files named in the ownership table.
