# Design notes — workflow instruction injection

Decision content for `ADR-010`. Evidence is limited to the three authority files plus direct reads of the cited paths. Premises supplied by the requester but not verified are labelled **premise**.

## 1. Problem and forces

The workflow tool's operating instructions live in two containers. `.opencode/agents/rug-workflow.md` carries prose that the agent reads only when its definition is loaded, so an agent that exposes the `workflow` tool without that definition gets the tool and none of the guidance. `.opencode/plugins/workflow.ts` carries a 36-element description (`WORKFLOW_TOOL_DESCRIPTION`, L16–L52, joined at L52 and passed at L97) that documents `subtask`, `log`, envelopes, guards, and one worked example; it contains no instruction-loading guidance beyond per-subtask `skills` (L29). The requester reports that agents weakly obey tool descriptions and that the description costs context on every request (**premise**; no measurement in the verified facts). The two containers also drift: the agent definition and the plugin description evolve on separate review paths with no shared version.

The harness already has a conditional-injection mechanism the repo uses in production. `.opencode/plugins/instructions-loader.ts` registers `context.tool.hook('execute.before', …)` (L84), gates on `TARGETED_TOOLS = new Set(['edit', 'write', 'read'])` plus a file path (L14, L85–L86), emits a `<steering … type="instructions">` payload (L55–L56), and pushes it into the system prompt from `context.session.hook('context', …)` with `event.system.push({ type: 'text', text: pending })` (L124–L128). The v2 `SessionContext` exposes the effective per-request tool map as `tools: Record<string, { description: string; input: JsonSchema.JsonSchema }>` (`dist/effect/session.d.ts:29–34`, field at L31), so a hook can gate on tool availability directly. The design analogy "OpenCode v2 injects instructions when code mode is available" is **premise**: no repo artifact establishes the code-mode renderer, its injection point, or OpenCode-core ownership (see §7). The decision must therefore stand on the verified plugin API, not on the code-mode precedent.

## 2. Candidate mechanisms

**A. Status quo — agent definition plus tool description.** Keep `rug-workflow.md` prose and the 36-line description. No new mechanism.

**B. Expand the tool description only.** Move all workflow guidance into `WORKFLOW_TOOL_DESCRIPTION` and delete it from agent definitions.

**C. Shared instruction text referenced from each agent definition.** One canonical markdown file that every agent definition exposing `workflow` references or embeds at authoring time. Agent definitions are markdown; no runtime include mechanism is verified.

**D. Static skill or instruction file loaded for every session.** Put the text in `.agents/skills/<name>/SKILL.md` or `.opencode/instructions/*.instructions.md` and rely on the existing loader. `.opencode/instructions/*.instructions.md` is indexed by `createIndex({ agent, instructionsGlob: '.opencode/instructions/*.instructions.md', … })` (`instructions-loader.ts:66–70`).

**E. Dedicated v2 plugin that injects on the session tool set.** New `.opencode/plugins/workflow-instructions.ts`; `context.session.hook('context', …)`; gate on `Object.hasOwn(event.tools, 'workflow')`; push a versioned block into `event.system`.

**F. Co-located injection inside `workflow.ts`.** Same hook and gate as E, registered by the plugin that already adds the tool (`context.tool.transform`, L94–L98) instead of a second plugin.

Options E and F are genuinely different from C and D: they are the only candidates whose trigger is the session tool set rather than file paths or authoring discipline. E and F differ in ownership, failure surface, and test isolation; neither collapses into the other.

## 3. Evaluation

Dimensions are applied to every candidate. A hard constraint disqualifies A–D from being the primary mechanism: the text must apply exactly when `workflow` is exposed, and only then.

### 3.1 Do agents respect it?

- **A** — Partly. The agent definition is instruction prose and is obeyed where loaded; other agents exposing `workflow` never load it. The description is read as tool schema, not head instruction. No verified adherence measurement.
- **B** — Unverified and doubtful. The existing 36-line description already mixes contract with example prose (`workflow.ts:16–52`); the requester reports weak adherence (**premise**). Expanding the same surface assumes a channel that already fails.
- **C** — Depends on authoring discipline. The text reaches the agent only if the definition embeds it; a definition that references a path does not load that path at runtime (no include mechanism verified). Agents without the definition get nothing.
- **D** — Strong where it fires. `.opencode/instructions/` is the repo's steering channel, with `<steering priority="high" reason="relevant files touched" type="instructions">` (`instructions-loader.ts:55–56`). It fires on file edits, not on tool availability.
- **E** — Same steering channel, different trigger: the text is a system-prompt part on every request where the tool is present. Instruction-shaped text in the system prompt is the strongest of the available channels.
- **F** — Identical delivery to E.

### 3.2 Context cost and cache impact

- **A** — Pays the 36-element description whenever the tool is exposed, plus definition prose when loaded. Two copies can both be resident.
- **B** — Pays every added byte on every request that carries the tool schema. A stable description is prefix-cache friendly, but the cost is unconditional while the tool is exposed and unbounded unless a cap is enforced.
- **C** — Pays once per loaded definition; no cost for agents that do not load it, which is also the correctness failure.
- **D** — Global `applyTo` costs every matching session; a narrow glob that never matches costs nothing and injects nothing.
- **E** — Pays the payload only when `workflow` is in `event.tools`; stable sentinel and stable tail position keep the prefix cacheable. The verified push appends at the end (`instructions-loader.ts:127`), which preserves the leading prefix. Cap the payload (recommended 4 KB) and skip with an event rather than truncating.
- **F** — Identical to E. No measurable difference; both pay one payload per request with the tool present.

### 3.3 Does it travel to other agents that expose the tool?

- **A** — No. The definition does not travel; the description does, which is why A partially works today.
- **B** — Yes. The description is part of the tool schema for every agent that receives the tool. This is B's strongest property and the reason it must be evaluated seriously.
- **C** — Only by manual duplication. Every new exposing agent needs an edit, and nothing detects the omission.
- **D** — No. The loader keys on file paths and `TARGETED_TOOLS` (`edit`, `write`, `read`), not on tools (`instructions-loader.ts:14`, L85–L86). Storing the text under the same glob also risks tool-independent injection during any file edit, including for agents without `workflow`.
- **E** — Yes. Detection is on the tool name in the per-request map, independent of which plugin registered it or which agent definition is loaded.
- **F** — Yes, for sessions where `workflow.ts` is the registrar. The repo verifies that `workflow.ts` is the only repo plugin adding the tool (`opencode-api-facts.md:108–111`), so coverage is currently identical to E.

### 3.4 Maintainability and single source of truth

- **A** — Two sources, no shared version, no golden fixture. Drift is the current defect.
- **B** — One source, but it is the tool contract surface; every instruction edit risks tool-call accuracy and is reviewed as plugin code.
- **C** — One canonical file plus N copies. Cheapest to author, most prone to silent divergence.
- **D** — One file, existing tooling, existing review path. Misleading because the loader's trigger is unrelated.
- **E** — One text module plus one small plugin, both unit-testable; the text lives outside the `instructionsGlob`, so the edit-path loader cannot double-inject it.
- **F** — One file, but mixes prompt text with tool registration and makes `workflow.ts` own two contracts.

### 3.5 Failure modes (hook absent, tool set unavailable, duplicates, tool removed mid-session)

- **A** — Never fails mechanically; fails by omission for unlisted agents.
- **B** — Never fails mechanically; the description is always present with the tool. Failure is behavioral (ignored prose).
- **C** — Fails silently when an author forgets the copy; no runtime signal.
- **D** — Fails open by not firing. A broad `applyTo` injects into sessions without the tool, which is worse than no injection.
- **E** — Plugin not loaded → no injection, no signal; mitigate with an integration test and a dual-run window. `event.tools` undefined at runtime → guard before `Object.hasOwn` and fail open. Duplicate push → scan `event.system` for the version sentinel before pushing; this is correct whether the array is cumulative or rebuilt, and avoids relying on unverified persistence. Tool removed mid-session → the next request lacks the key and no new text is added; text already accumulated in a cumulative prompt may remain (open question).
- **F** — Same, plus: if `workflow.ts` fails to load, the tool is also absent, so the failure is self-consistent.

### 3.6 Dependency and version risk

- **A, B, C, D** — No plugin-API dependency.
- **E, F** — Depend on the Effect plugin surface `Plugin { readonly id; readonly effect }` (`dist/effect/plugin.d.ts`) and on `SessionContext.tools` (`session.d.ts:31`). Pinned versions: `@opencode/plugin 2.0.24` (resolved), runtime `opencode v2.0.32` (`opencode-api-facts.md:9–18`). Risk is a typing change to `SessionContext` or to `SystemPart`; a golden fixture plus a typecheck gate catches the former at build time, not the latter.

### 3.7 Scoring

Criteria from `adr-template` (−2..+2; higher is better; initial cost: higher = cheaper).

| Criterion | A | B | C | D | E | F |
|---|---|---|---|---|---|---|
| Maintainability | −1 | −2 | 0 | 1 | 1 | 0 |
| Flexibility | −1 | −2 | 0 | −1 | 2 | 1 |
| Implementation ease | 2 | 2 | 1 | 1 | 0 | 0 |
| Initial implementation cost | 2 | 2 | 1 | 1 | 0 | 1 |
| **Total** | **2** | **0** | **2** | **2** | **3** | **2** |

Constraint (documented here, not in `## Decision`): the mechanism must inject exactly when `workflow` is in the session tool set. A, B, C, and D fail that constraint as a primary mechanism; B and C remain useful as travel-by-other-means. E wins on total and satisfies the constraint with the verified hook.

## 4. Recommendation

**Primary: Option E** — a dedicated plugin, `id: 'opencode.workflow-instructions'`, injecting from `context.session.hook('context', …)`.

- **Hook:** `context.session.hook('context', event => …)`, the v2 Effect session hook. Verified type: `readonly context: SessionContext` (`dist/effect/session.d.ts:131`).
- **Detection:** `Object.hasOwn(event.tools, 'workflow')`, where `event.tools` is `SessionContext.tools: Record<string, { description: string; input: JsonSchema.JsonSchema }>` (`session.d.ts:29–34`). The map is the effective per-request tool map, so it follows agent exposure rather than global registration; `context.tool.list()` returns only the globally registered set (`dist/effect/tool.d.ts:51`).
- **Payload home:** `.opencode/plugins/helpers/workflow-tool-instructions.ts`, exporting `WORKFLOW_INSTRUCTIONS_VERSION` and `WORKFLOW_INSTRUCTIONS`. Outside `.opencode/instructions/*.instructions.md`, so the edit-path loader's index cannot pick it up (`instructions-loader.ts:66–70`). Version the payload independently of the plugin.
- **Idempotency:** versioned sentinel, e.g. `<workflow_instructions version="1">`, detected by scanning `event.system`. This needs no assumption about whether `system` persists across turns.
- **Budget:** 4 KB UTF-8 cap; over cap, emit a warning and skip the whole block (never truncate instructions).
- **Failure posture:** fail open — log, do not throw, do not block the session. Wrap the handler in `Effect.catchAllCause`.

Sketch (v2 Effect surface, matching `workflow.ts:91–115` and the push shape at `instructions-loader.ts:127`):

```ts
import { Effect } from 'effect'
import type { Plugin } from '@opencode/plugin/effect/plugin'
import { WORKFLOW_INSTRUCTIONS, WORKFLOW_INSTRUCTIONS_VERSION } from './helpers/workflow-tool-instructions'

const TAG = '[workflow-instructions] '
const SENTINEL = `<workflow_instructions version="${WORKFLOW_INSTRUCTIONS_VERSION}">`
const BYTE_CAP = 4096

const byteLength = (text: string): number => new TextEncoder().encode(text).length

const plugin: Plugin = {
  id: 'opencode.workflow-instructions',
  effect: context => Effect.gen(function* () {
    yield* context.session.hook('context', event => Effect.gen(function* () {
      if (event.tools === undefined || !Object.hasOwn(event.tools, 'workflow')) return

      const present = event.system.some(part =>
        part.type === 'text' && part.text.startsWith(SENTINEL))
      if (present) return

      const payload = `${SENTINEL}\n${WORKFLOW_INSTRUCTIONS}\n</workflow_instructions>`
      const bytes = byteLength(payload)
      if (bytes > BYTE_CAP) {
        yield* Effect.logWarning(TAG + 'payload over cap; skipped', { bytes, cap: BYTE_CAP })
        return
      }

      event.system.push({ type: 'text', text: payload })
      yield* Effect.logInfo(TAG + 'injected', {
        sessionID: event.sessionID,
        agent: event.agent,
        version: WORKFLOW_INSTRUCTIONS_VERSION,
        bytes,
      })
    }).pipe(Effect.catchAllCause(() => Effect.logWarning(TAG + 'injection failed'))))
  }),
}

export default plugin
```

The `part.type`/`part.text` narrowing in the sentinel scan is the one typing detail not guaranteed by the verified facts: repo code pushes `{ type: 'text', text }` (`instructions-loader.ts:127`) but the `SystemPart` union was not inspected (open question 6). If the union does not narrow, replace the predicate with a small typed helper and keep the sentinel string as the only contract.

**Fallback: Option F** — the same hook, gate, payload, sentinel, and cap, registered inside `workflow.ts`. Choose F if a second plugin is rejected, if load-order or packaging constraints appear, or if the dedicated plugin proves untestable in isolation. F is strictly weaker on maintainability and test isolation and strictly stronger on shipping atomicity: the tool and its instructions cannot diverge. Migration from E to F is a move of the `context.session.hook` block; rollback is the reverse.

Out of scope: GitHub Copilot and DSH have no verified hook that observes a session tool set. No equivalent is claimed. Options C or B remain the degraded cross-harness fallback, and the ADR should say so rather than imply portability.

## 5. Implementation outline, risks, migration

### Implementation outline

1. **RED tests** in `.opencode/plugins/tests/workflow-instructions.test.ts`: injection exactly once when `event.tools` contains `workflow`; zero injection when absent; no second push when the sentinel is already in `event.system`; over-cap payload skips entire block; a throwing handler does not throw out of the hook.
2. **Golden fixture** for the rendered payload plus version, asserted byte-for-byte.
3. Add `.opencode/plugins/helpers/workflow-tool-instructions.ts` and `.opencode/plugins/workflow-instructions.ts`.
4. Add a structured injection event: `workflow-instructions.injected` / `.skipped` / `.failed` with `sessionID`, `agent`, `version`, `bytes`, `cap`, `errorClass`. A debug switch that dumps the rendered block is desirable; no verified config surface exists, so keep it as a follow-up rather than inventing one.
5. Run `just opencode::test`, `just opencode::lint`, `just opencode::typecheck` (plugin quality gates).
6. **Dual-run:** keep `rug-workflow.md` prose for a window; compare sessions. Remove the duplicated prose only after the removal criteria hold.
7. Trim the tool description to the tool contract (subtask/log semantics, envelope, guards, one example); stop using it for instructions. This is a consequence of the decision, not a second decision.

### Migration and rollback

Dual-run, then remove. Removal criteria, declared before rollout: ≥20 sessions in which every session exposing `workflow` shows exactly one injection, zero sessions without the tool show an injection, and zero `failed` events. Rollback is a revert: delete the plugin file (or the hook block in F) and restore the agent-definition prose from git. A runtime flag would be preferable per the ADR checklist, but no verified config surface exists for this plugin; do not claim one. Record this deviation in `## Considerations`.

### Risks

- **Silent absence.** A plugin that does not load cannot report. The only detection is the integration test plus the dual-run observation.
- **Stale text after tool removal.** If `system` is cumulative, earlier injected text may persist after `workflow` disappears from the tool set. Behavior is unverified; do not promise eviction.
- **Double injection.** Possible if both E and F ship, or if instructions are also placed under `.opencode/instructions/`. Enforce one owner and a single payload home.
- **Payload drift.** Version constant and fixture must move together; an unversioned edit breaks trace forensics.
- **Dual-run conflict.** Two instruction sources can disagree during migration; precedence is the injected block, and the removal window must be bounded.
- **Token cost.** Bounded by the 4 KB cap per request with the tool present; measure rather than estimate.

### Open questions

1. Does `session.hook('context')` fire for every request shape (normal turn, resume, compaction, generate), and is `event.tools` populated in each? Typed as per-request; runtime behavior unverified.
2. Does a `system.push` persist across turns or is `system` rebuilt per request? The sentinel scan is designed to be correct either way; eviction of stale text is not.
3. Is `event.tools` filtered by agent permissions or only by registration? Only `SessionContext.tools` is typed per-request; `tool.list()` filtering is unverified.
4. Exact `SystemPart` variant accepted by `system.push`.
5. Inter-plugin hook ordering has no stated guarantee (`opencode-api-facts.md` OPEN 3). E does not depend on other plugins, so the risk is confined to ordering with a future injector.
6. Which agents expose `workflow` today? Agent tool declaration is unverified; the ADR's scope statement must not enumerate agents as fact.
7. Does a frontmatter/status lint gate apply to ADRs? Unverified.

### Revisit triggers

- `@opencode/plugin` moves past `2.0.24`, or `SessionContext.tools` / `SystemPart` changes shape.
- OpenCode adds native conditional injection for plugin-registered tools, making E redundant.
- A second plugin or harness path registers a tool named `workflow`, changing the detection's meaning.
- Measured payload exceeds the cap, or a session shows duplicate or missing injection.
- Twenty sessions of dual-run evidence complete, or the removal criteria fail.
- A harness other than OpenCode needs the same behavior; that reopens the portability question with a new mechanism, not by extending this one.

## 6. Canonical ADR record

- **Path:** `.serena/memories/architecture/adr/ADR-010-workflow-tool-instruction-injection.md`
- **Serena memory name:** `architecture/adr/ADR-010-workflow-tool-instruction-injection`
- **Filename rule:** `ADR-<three-digit id>-<kebab-case-slug>.md`; highest existing id is 009 (`repo-facts.md:10–13`), so the id is `ADR-010`.
- **Proposed title:** `Inject Workflow Instructions When the Workflow Tool Is Exposed`

Frontmatter, exactly the five required fields (`adr-rules`, `adr-template`):

```yaml
---
id: ADR-010
title: Inject Workflow Instructions When the Workflow Tool Is Exposed
status: proposed
date: 2026-10-19
scope: OpenCode RUG harness — workflow tool instruction injection for every agent that exposes the workflow tool
---
```

Status vocabulary: `draft` → `proposed` → `accepted` or `rejected`; a later decision makes an earlier one `superseded` with a `superseded-by: ADR-NNN` note and never rewrites history. A new record starts at `proposed`.

Required section headings, verbatim and in this order:

```markdown
# ADR-010: Inject Workflow Instructions When the Workflow Tool Is Exposed

## Decision

## Considerations

### Context

### Options considered

### Scoring

### Consequences
```

Option entries use `#### Option A: <name>` and carry `Pros:` / `Cons:` lists. `## Decision` comes first and must read standalone: state the chosen mechanism, the trigger, the payload location, and the precedence rule, without scores, rejected options, or hedging. `### Scoring` uses the four template criteria (maintainability, flexibility, implementation ease, initial implementation cost), every option scored on every criterion, explicit totals, highest total wins. A constraint that overrides the score is documented under `## Considerations`, not in `## Decision`. The template has no `## Confirmation` or `## Revisit triggers` section: put the acceptance tests, observability event, rollback criteria, and revisit triggers inside `### Consequences`. Additional `###` subsections under `## Considerations` are consistent with existing records (ADR-009 adds `### Mechanism`), but top-level order stays `## Decision` then `## Considerations`.

**Index or registry:** no index file exists in `architecture/adr/`; `git ls-files` lists ADR-001 through ADR-009 only. `mem:architecture/about` is the domain discovery surface and lists records in its `## Structure` section, stopping at ADR-008 (ADR-009 is already missing). `adr-rules` does not require an index update. Recommended: update `architecture/about` in the same change — add ADR-010 and correct the missing ADR-009 entry — via `edit_memory` or `write_memory`, with the same gate as the ADR.

**Sanctioned write mechanism:** the ADR store is a Serena memory namespace, not a plain `docs/` directory, and `.serena/` is outside the filesystem server's allowed directories. Write with the Serena gateway operation `write_memory({ memory_name: "architecture/adr/ADR-010-workflow-tool-instruction-injection", content: <full markdown> })` through the `serena` MCP server, following the `serena-memory` store workflow: run the pre-write gate, write, then `read_memory` and confirm the echoed content matches. Do not create the file with a direct filesystem write, and do not `git add`/`commit` without explicit authorization.

## 7. Claim ledger

### Facts the ADR may cite

| Fact | Location |
|---|---|
| Workflow tool registration and plugin id | `.opencode/plugins/workflow.ts:91–115`; quote L94–L98 |
| Description is a 36-element array used verbatim | `.opencode/plugins/workflow.ts:16–52`, L97 |
| Description documents only per-subtask `skills` for loading | `.opencode/plugins/workflow.ts:29` |
| Edit-path injection precedent: hook, tool gate, steering payload | `.opencode/plugins/instructions-loader.ts:14`, L55–56, L84–86, L114, L124–129 |
| Instruction index glob | `.opencode/plugins/instructions-loader.ts:66–70` |
| System push shape | `.opencode/plugins/instructions-loader.ts:127` |
| Idempotency key format | `.opencode/plugins/helpers/instruction-context-helper.ts:62` |
| `SessionContext` carries the per-request tool map | `.opencode/node_modules/@opencode/plugin/dist/effect/session.d.ts:29–34` (field L31) |
| `SessionHooks.context` type | `.opencode/node_modules/@opencode/plugin/dist/effect/session.d.ts:129–131` |
| `tool.list()` is the globally registered set | `.opencode/node_modules/@opencode/plugin/dist/effect/tool.d.ts:51` |
| Effect plugin surface shape | `.opencode/node_modules/@opencode/plugin/dist/effect/plugin.d.ts` |
| Resolved plugin/API versions | `opencode-api-facts.md:9–18` (`@opencode/plugin 2.0.24`, runtime `v2.0.32`) |
| `workflow.ts` is the only repo plugin adding the tool | `opencode-api-facts.md:108–111` |
| ADR directory, naming, ids 001–009 | `repo-facts.md:9–13` |
| ADR frontmatter fields, section order, status lifecycle, scoring | `.serena/memories/architecture/adr-rules.md`; `adr-template.md` |
| `architecture/about` lists ADRs and omits ADR-009 | `.serena/memories/architecture/about.md`, `## Structure` |
| ADR format rationale (Nygard, MADR, anti-patterns) | https://www.cognitect.com/blog/2011/11/15/documenting-architecture-decisions ; https://adr.github.io/madr/ ; https://ozimmer.ch/practices/2026/09/12/ADRMistakes.html |

### Claims that must NOT be asserted

- That `.opencode/plugins-quarantine/` exists, or that the instructions loader/test were quarantined or removed. It does not exist; both files are live under `.opencode/plugins/`.
- That zero v1 hook names appear anywhere in plugin sources. They appear in comments in `plugins/helpers/envelope-store.ts`; the verifiable claim is that all five repo plugins import the Effect surface.
- That the code-mode injection mechanism, the `core/codemode` renderer, the string `# Code Mode`, or `Nf=JT.make("core/codemode")` is OpenCode-core code. Provenance is unestablished; `/tmp/opencode/oc-strings.txt` also contains DSH/DeepSeek strings.
- That OpenCode v2 injects code-mode instructions at a specific point, or that the equivalent is a documented extension point. Treat the analogy as design intent only.
- That agents measurably ignore tool descriptions. This is the requester's premise, not a measured result.
- That `tool.list()` is or is not filtered per agent. Only `SessionContext.tools` is typed per-request.
- That `system.push` persists across turns, that hook ordering is deterministic, or which exact `SystemPart` variant `push` accepts.
- That `workflow` is exposed to a specific named set of agents. Agent tool declaration and `rug-workflow.md` body were not verified.
- That a frontmatter/status validator such as `agent_utils/scripts/validate_memory_frontmatter.py` applies to ADRs.
- That the idempotency key sits at `instruction-context-helper.ts:52`; it is at L62.
- That the ADR template contains `## Confirmation`, `## Decision drivers`, or owner/reviewer frontmatter fields. It does not; do not invent them.
- That a runtime feature flag exists for plugin behavior. No such config surface is verified.
