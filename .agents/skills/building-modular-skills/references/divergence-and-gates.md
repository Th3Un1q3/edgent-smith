# Reference: Divergence and Gates

Three runnable protocols that stop an author from confirming its own bias: force divergent candidates, hand the finished tree to a blind critic, and close the run on a machine gate. Run them in order before declaring a skill complete.

**When to load:** after you finish a skill tree and before you run the [Shaping Checklist](../workflows/shaping-checklist.md); when the checklist gate exits nonzero; when a review suspects the first draft became the only draft.

## Vocabulary

- **attractor** — the shape the author reaches for first; left unchecked, it becomes the only candidate.
- **blind critique** — a review by an agent that sees the finished tree only, without the author's rationale or candidate list. Blindness holds when the critic reads the tree with no author rationale and no candidate list. A separate session is one realization; withholding context in the prompt is the fallback where a harness cannot spawn one.
- **machine gate** — the exit code of the skill validator. Realization in this repo: `just agent_utils::validate-skill <name>`; zero passes, any other value blocks. On a harness without `just` or a shell, use the equivalent exit-code check; where none exists, mark the gap (see Protocol 3 fallback).
- **weakest-model gate** — a gate the weakest model tier can run end to end, with no human help, and read as pass or fail. The tier is the weakest model tier the harness offers; if none is selectable, skip the run and record the waiver.

## Protocol 1: Diverge, then converge

Prevents the first-idea attractor: the first candidate shape becomes the only candidate, and the author skips testing it against an alternative.

Shape means where the root splits from its references, where a workflow boundary falls, or where a gate sits. Draft at least two candidate shapes, name each as a hypothesis about the failure it fixes, and pick the winner on a stated test.

1. List at least two candidate shapes before you write the final tree. Done when: each candidate names a distinct root/workflow/reference split and the failure it prevents.
2. State one test per candidate: what the shapes do differently for a real task. Done when: each test predicts an observable difference — a file loads or stays unread, a gate fires or sits silent.
3. Pick the winner against the tests and record why the loser lost in one line. Done when: the tree on disk is the winner and the reason survives in `metadata.delta`.

Example candidate pair for a skill that teaches three commands:
- Shape A: one `references/commands.md` with three sections.
- Shape B: `references/command-one.md`, `command-two.md`, `command-three.md`.
- Test: does a reader load only the command they need? Shape B loads one file; Shape A loads all three.

## Protocol 2: Blind critique

Prevents self-grading: an author that reviews its own work confirms the bias it carried into the draft.

The goal is independent adversarial evaluation: a critic that cannot inherit the author's reasoning path. Realize this outcome by isolating the critic from the author's context. Where the environment cannot spawn a separate reviewer, a human performs the pass. In every case withhold your rationale, candidate list, plan, and `metadata.delta`; give the critic two inputs only — the path to the finished tree and the pointer to Rules 1–24 in [guidance-structure.md](./guidance-structure.md), [guidance-content.md](./guidance-content.md), and [guidance-process.md](./guidance-process.md). Record "(manual review required)" and the reason in `metadata.delta`.

1. Isolate the critic from the author's context. Realization: spawn a separate reviewer where the environment supports it — done when the proof artifact records how the critic was isolated and confirms no shared reasoning path. Fallback where the environment cannot spawn a separate reviewer: withhold the rationale, candidate list, plan, and `metadata.delta` in the prompt — done when the proof artifact records which blindness conditions were enforced and which could not be.
2. Give the critic the tree path and Rules 1–24 only. Done when: the prompt names the tree path and the rules, and nothing else.
3. Ask for every violation with a file and rule number. Done when: the critic reports findings by file and rule number.
4. Resolve every finding: fix it, or record why the pass holds. Done when: each finding is either fixed or explained in `metadata.delta`.

**Proof artifact:** the critic's report at `reports/blind-critique-<name>.md`. Its header records the reviewer identity, a verbatim copy of the prompt, and the blindness conditions met. Pass: the prompt contains only the tree path and the Rules 1–24 pointer. Record the critic identity where the environment exposes one and require it to differ from the author's; otherwise record the withheld-context statement. Any rationale or candidate list in the prompt fails the blindness check.

## Protocol 3: Machine gate

Prevents self-attestation: a gate carried in prose passes without evidence.

The outcome: an independent exit-code check runs the skill validator and blocks on a nonzero result. Realization in this repo: `just agent_utils::validate-skill <name>` runs `validate_md_links.py` and `audit_fences.py` and prints the root/reference budgets; zero passes, any other value blocks. Where the environment cannot run `just` or a shell, use the equivalent exit-code check; where none exists, mark the gap "(manual review required)" and record it in `metadata.delta` along with the verifier (a human who runs the command, or a CI job on the repo). Done when: the command prints its checks and exits 0. A nonzero exit blocks completion until you fix every violation it prints.

## Weakest-model gate

Prevents a human-only gate: a gate phrased so only a careful human can complete it sits unrun by the model that owns it.

**Model selection:** pick the lowest-capability model the environment makes selectable; set it where the environment selects models. Where the environment cannot select a weaker tier, a human runs the gate against the weakest available model. If no weakest tier exists at all, record a waiver in `metadata.delta` and continue without this gate.

**Artifact it consumes:** the skill's root `SKILL.md` alone; the weak model gets no reference files and no author help.

**Pass condition:** the weak model reads the root, runs the machine gate's repo realization as written, and it exits 0. Where the harness cannot run the gate, the waiver in `metadata.delta` records the gap and the named verifier. **Fail:** the model asks how to run the gate, needs a reference file to locate the command, or the command exits nonzero.

Record the run — model id, command, exit code — in `metadata.delta`. When a run must skip a check, record the waiver there with its reason; a silent skip reads as a pass.
