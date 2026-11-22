---
id: researches/aidlc-workflows-concepts
L0: "awslabs/aidlc-workflows: 5 phases, 33 stages, 11 scopes; workspace > space > intent > record dir; five memory tiers; six advisory sensors wired at gates."
freshness: 2026-11-21
provenance: awslabs/aidlc-workflows, 2026-11-21
version: 3
---
# AI-DLC (awslabs/aidlc-workflows): concepts, tiers, sensors

> **Digest.** 5 phases, 33 stages, 11 scopes (docs/guide/glossary.md:57, :77, :70); rules are feedforward, sensors are feedback (glossary.md:22).
> Containers: workspace > space > intent > record dir (glossary.md:85, :76, :37, :62); intent is a registry row, not the scope.
> Unit of work is the WHAT (glossary.md:80); a bolt is a Construction delivery slice over linked units (:12); batch and swarm are runtime groupings (:55, :84).
> Five memory tiers org/team/project/phase/stage (core/memory/org.md:3-6); "staged memory" appears in no file.
> Six advisory sensors sit at gates — advisory, not blocking.
> Further down: the tier table with write/read triggers, sensor wiring, and the citation list.

Source: awslabs/aidlc-workflows, 2026-11-21. Citations are repo path:line; a bare :n continues the file named before it.

**Frame.** Methodology, and "a single execution of the methodology is a workflow" (docs/guide/glossary.md:42, :86). Rules = feedforward, sensors = feedback (docs/guide/glossary.md:22), the control loop. Engine = routing tool (:29); directive = typed next instruction (:27); conductor = the /aidlc session (:20). Stage = lead agent + defined inputs/outputs + stage protocol (:77). Traceability checks at every phase boundary except Initialization to Ideation (docs/guide/04-phases-and-stages.md:63). State = committed Markdown; audit = committed folder, so review needs no vendor dashboard (docs/guide/10-state-and-audit.md:9, :3).

**Phases.** Initialization 0, Ideation 1, Inception 2, Construction 3, Operation 4; stages 3/7/9/7/7; ranges 0.1-0.3, 1.1-1.7, 2.1-2.9, 3.1-3.7, 4.1-4.7 (docs/guide/glossary.md:57; docs/guide/04-phases-and-stages.md:18-61).

**Scope.** "One of 11 named configurations (enterprise, feature, mvp, poc, bugfix, refactor, infra, security-patch, classic, workshop, express) that determines which stages execute and at what depth" (docs/guide/glossary.md:70); synonym workflow profile, "a curated lifecycle for a kind of work" (:87). Neither time-box nor initiative; agents propose it from freeform intent (:70). Skipped stage = [S], no gate (docs/guide/04-phases-and-stages.md:67, :69, :86).

**Containers.** Workspace > Space > Intent > Record dir > artifacts/state/audit (docs/guide/glossary.md:85, :76, :37, :62). Space = aidlc/spaces/SPACE/ with memory/, knowledge/, intents/ (:76). Intent = "a unit of work tracked as a row in the space's intents.json registry" (:37) and is the initiative-like container, not the scope (:37). Record dir = per-intent artifacts, per-stage memory.md, aidlc-state.md, audit/ (:62).

**Unit vs bolt.** Unit of work = "the WHAT: an independently implementable piece of the solution, decomposed during stage 2.7" (docs/guide/glossary.md:80). Bolt = "a planned Construction delivery slice over one or more dependency-linked Units" (:12). Parallel batch = runtime grouping of dependency-ready units, "not a Bolt-plan grouping" (:55); swarm gives each unit its own worktree (:84). Construction 3.1-3.7 repeats per unit, walked unit-major or stage-major (docs/guide/04-phases-and-stages.md:72, :74, :75). Naming trap: the intent is "a unit of work tracked as a row" (docs/guide/glossary.md:37) while Unit is the WHAT (:80).

**"Staged memory" caveat.** No file uses the phrase. The repo says memory + tier names org/team/project/phase + "the stage's memory" (core/memory/org.md:3-6). The research child reads it as either the per-stage memory file kept current during a stage (core/knowledge/aidlc-shared/memory-template.md:2) or the org, team, project resolver (core/memory/org.md:3-6); neither is named "staged".

| Tier | File | Written | Read |
|---|---|---|---|
| org | core/memory/org.md | ships with the framework | every run, with team and project (core/memory/org.md:3-6) |
| team | core/memory/team.md | practices-discovery affirmation gate; ## Corrections by the self-learning loop (:3-7, :49-51) | after org, before project |
| project | core/memory/project.md | practices-discovery + self-learning loop (:3-6, :47-50) | last |
| phase | core/memory/phases/PHASE.md (ideation, inception, construction, operation) | static body; learning-loop corrections (core/memory/phases/ideation.md:3-4) | when a stage declares phase: (:30) |
| stage | core/knowledge/aidlc-shared/memory-template.md, per stage | continuously while the stage runs (core/knowledge/aidlc-shared/memory-template.md:2) | later stages + learning loop; owning code not located |

Narrower layers override org, resolved "from the active space" (core/memory/org.md:3-6, :11-13). Team is strict-additive, "edit at the gate, not directly" (core/memory/team.md:3-7). Project is strict-additive and records DECIDED: [decision] (Stage [slug], [date]) (core/memory/project.md:3-6, :47-50). Phase guardrails apply to "every stage whose phase: X declaration imports them" (core/memory/phases/ideation.md:3-4). Stage memory sections: Interpretations, Deviations, Tradeoffs, Open questions (core/knowledge/aidlc-shared/memory-template.md:4-15); "a fresh template parses to total=0 (MEMORY_EMPTY)", "t100 guards this" (:1).

**State and audit.** aidlc-state.md = "the single source of truth for that intent's workflow progress"; engine reads it each session start (docs/guide/10-state-and-audit.md:9). Sections: Scope Configuration, Phase Progress, Stage Progress, Current Status, Session Resume Point (:23-36). Audit = 134 events, 27 categories, incl. MEMORY_EMPTY, RULE_LEARNED, SENSOR_PROPOSED (:161-193, :191). Write guard is "a guardrail, not a security boundary" (:155-158).

**Sensors.** "A deterministic verification check defined by a manifest in .claude/sensors/"; six ship, all advisory at their severity line, so they stop nothing until a manifest turns blocking (docs/guide/glossary.md:71; docs/reference/07-sensor-system.md:213; core/sensors/aidlc-claim-sources.md:5).

| id | checks | trigger |
|---|---|---|
| claim-sources | source tags resolve to the confirmed register | gate (core/sensors/aidlc-claim-sources.md:5-9) |
| required-sections | required H2 headings present | gate (core/sensors/aidlc-required-sections.md:5-9) |
| traceability | upstream coverage, downstream targets, orphans | gate (core/sensors/aidlc-traceability.md:5-9) |
| upstream-coverage | consumes: artifacts referenced | gate (core/sensors/aidlc-upstream-coverage.md:5-9) |
| linter | project linter, TS/JS | write; default when fire_on absent (core/sensors/aidlc-linter.md:5-8) |
| type-check | tsc, TS/TSX | write; default (core/sensors/aidlc-type-check.md:5-8) |

Attachment is pull: stage frontmatter sensors: list of bare ids (core/aidlc-common/stages/construction/ci-pipeline.md:24-28); the resolver bakes sensors_applicable[] onto the node, no applies_to in the manifest (docs/reference/07-sensor-system.md:170-205). Write-fired on Write|Edit (core/hooks/aidlc-run-sensors.ts:1). Gate-fired on gate-start/revise enumerating declared deliverables (stage-protocol-sensors.md:21-23, core/tools/aidlc-state.ts:1053); the write hook skips them (core/hooks/aidlc-run-sensors.ts:228). Advisory emits audit rows, does not stop; blocking needs a verified pass — findings, unavailable evaluation, malformed output and timeouts refuse gate entry until fixed or overridden; autonomous mode cannot override; override = logged decision + --override-blocking-sensors (stage-protocol-sensors.md:29-34, :9-10). Executor = PostToolUse hook core/hooks/aidlc-run-sensors.ts, "always exit 0"; blocking semantics in aidlc-state.ts enforceBlockingGateSensors (:15-18, :309). Worker = {{INVOKE}} engine sensor-ID, deterministic TypeScript, not an LLM (core/sensors/aidlc-claim-sources.md:4).

**Gaps.** (1) The research child never read the 33 stage names: the phase map stops at range level (docs/guide/04-phases-and-stages.md:18-61), and the names sit in that file around lines 90-495. (2) Install target: the glossary says .claude/sensors/ (docs/guide/glossary.md:71), the shipped manifests are in core/sensors/, and no file the research child read says which installs the other. Also unconfirmed: "Band" definition; "cycle" as a term; core/aidlc-common/protocols/stage-definition.md; the instantiated memory.md path; loader/resolver code; audit shard pattern; enforceBlockingGateSensors definition; sensor dispatch internals; PostToolUse settings. The research child's sensor count rests on a directory listing plus docs/reference/07-sensor-system.md:213, not a repo-wide search; the research child settled on :213 after finding :217 superseded.
