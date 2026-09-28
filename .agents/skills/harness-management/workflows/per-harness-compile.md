# Compile One Skill Source to Harness Variants

Use this workflow when the same guidance must reach more than one harness, and you want one source instead of hand-maintained copies.

**Failure this prevents:** hand-written per-harness variants drift. A fix lands in one variant and misses the others, so the harnesses disagree about the rule.

## When to Use This Change Type

Use this change type when:
- The same guidance must reach more than one supported harness: OpenCode, DSH, or GitHub Copilot.
- You are about to copy a file into a second harness home.
- A change to shared guidance would otherwise need the same edit in N places.

## Supported Targets

| Harness | Variant home | Load behavior |
|---|---|---|
| OpenCode | `.opencode/instructions/`, `.opencode/agents/` | loads at server start |
| DSH | `.dsh/cordis.patch.yml`, `.dsh/child-runtime/cordis.yml` (Cordis `skill` plugin), `.dsh/settings.yaml` | picked up at the next DSH session |
| GitHub Copilot | `.github/agents/`, `.github/prompts/`, `.github/instructions/`, `.github/copilot-instructions.md` | read by the GitHub Copilot Chat agent and prompt picker |

The universal source lives under `.agents/skills/<name>/` and stays harness-neutral. `.dsh/.agent-presets/` (DOT) holds DSH orchestration presets, not skill content; DSH skill loading is the Cordis `skill` plugin wired in `.dsh/child-runtime/cordis.yml`. `.dsh/agent-presets/` (no dot) is a legacy placeholder the harness does not scan (see `.dsh/README.md`). GitHub Copilot has no skill directory of its own, so compile GitHub Copilot variants to the four real homes above and do not invent a `.github/skills/` path. Conductor (scaffold) and System A (harness-free runtime) have no skill loader: deliver the source as plain files the workflow author reads, and name the verifier — a human or a CI job running the repo `just` gates.

## Decide: Is This the Right Change Type?

- One harness only: write the file directly; do not add a build step for a single target.
- Independent per-harness content: keep separate files and skip this workflow. Compile only content that must stay identical.
- Transient knowledge: use `context-gathering` memories instead.

## Procedure

1. Designate the universal source. Keep it under `.agents/skills/<name>/` and shaped per `building-modular-skills`.
2. List the harness deltas. A variant differs only in frontmatter, file paths, and load semantics. Write the deltas down in one place, not inside the generated file.
3. Generate each variant from the source with a deterministic transform. No generator ships in this repo: write a small script or a documented manual transform, and commit it next to the source. A transform you cannot re-run is a copy, and copies drift.
4. Add the parity check. Regenerate into a temporary path and compare against the checked-in variant; any difference fails.
5. Apply per harness. OpenCode changes need a restart; DSH changes are picked up at the next session.

## Parity Check

Run after every source edit. A nonzero exit blocks the change.

```bash
# 1. Regenerate the variant into a temp path with your transform.
# 2. Compare it against the checked-in variant; any output means drift.
diff -r /tmp/<name>-variant <harness-variant-path> && echo "parity: clean"
```

Replace `/tmp/<name>-variant` and the variant path with the real paths. A missing generator means step 3 is not done.

## Format and Conventions

- The universal source holds the body prose once. Variants hold only the harness delta.
- Each variant's YAML frontmatter must parse for its harness.

## Verify

- Run the parity check; expect `parity: clean`. Any difference prints and exits nonzero.
- Confirm each variant's frontmatter parses as YAML.
- Confirm the universal source still passes the skill validator. In this repo: `just agent_utils::validate-skill <name>`. On a harness with a shell but no `just`, run the validator directly; where no shell exists, a human or a CI job runs it and records that.

## Done When

- The parity check is silent for every harness variant.
- A source edit plus a regeneration produces a matching variant with no manual edits.
- The universal source audits exit 0.
