# Reference: Skill Kinds — Direct vs Meta

When to load: when you convert a YouTube transcript into a skill; choose kind before drafting frontmatter.

Vocabulary: **direct skill** — executes the procedure the video teaches; the user repeats steps with automation; **meta skill** — applies the video's mental model to evaluate work; **failure mode** — the specific way a run fails without the skill.

## Vocabulary

- **direct skill** — executes the procedure the video teaches; the user repeats the video's steps with automation.
- **meta skill** — applies the video's mental model to evaluate or critique new work; the user thinks like the video.
- **failure mode** — the specific way a run fails without the skill; every skill description names one.

## 1. Direct Skill

Automate what the video teaches. Use when the transcript contains replayable steps.

Name the failure mode the skill fixes and list trigger phrases that fire it.

```yaml
name: pytest-fixture-builder
description: >
  Fix brittle, copy-pasted test setup by generating scoped pytest fixtures.
  Use when the user mentions pytest fixtures, conftest, or "repeated setup in tests".
```

Triggers: "build me fixtures", "pytest setup keeps breaking", "extract conftest fixtures".
Workflow owns steps; reference holds fixture scope table and API.

## 2. Meta Skill

Distill how the video thinks. Use when the transcript offers a framework, critique lens, or decision model.

Name the analytical failure mode and list trigger phrases that fire the critic.

```yaml
name: test-design-critic
description: >
  Fix unreviewed test design that drifts toward slow or coupled suites.
  Use when the user asks to score tests, audit fixtures, or review test architecture.
```

Triggers: "critique my test suite", "score test design", "are these fixtures over-coupled".
Reference owns the rubric; workflow runs the scoring pass.

## 3. Decision Rubric

Propose both kinds for every video; flag one primary via score.

| Signal | Kind | Score |
|---|---|---|
| Step-by-step tutorial, commands to replay | Direct | +2 Direct |
| Framework, trade-off analysis, conference talk | Meta | +2 Meta |
| Viewer can copy outcome same day | Direct | +1 Direct |
| Viewer can judge new work after watching | Meta | +1 Meta |
| Tie → propose both, mark Direct primary if tutorial else Meta primary | Either | — |

```text
Video "Pytest Fixtures Deep Dive" — tutorial on scoped fixtures (+2 Direct)
+ copyable conftest example (+1 Direct) → primary Direct, secondary Meta
```

## 4. Frontmatter Patterns

Use kebab-case names, trigger-rich descriptions, and active-verb principles.

Direct pairs a failure fix with replay triggers; workflow holds the replay steps.

```yaml
name: pytest-fixture-builder
description: >
  Fix brittle test setup by generating scoped pytest fixtures.
  Use when the user mentions pytest fixtures, conftest, or repeated test setup.
```

Meta pairs an analytical failure with critique triggers; reference holds the rubric.

```yaml
name: test-design-critic
description: >
  Fix unreviewed test design by scoring coupling, speed, and scope.
  Use when the user asks to audit, score, or critique a test suite.
```

## 5. Worked Examples — Same Video

Both derive from one source: "Pytest Fixtures Deep Dive" (30 min, fixtures, scope, conftest).

```yaml
# Direct: workflows/build-fixture.md runs the build; references/fixture-scopes.md holds scope table
name: pytest-fixture-builder
description: >
  Fix brittle, copy-pasted setup by generating scoped pytest fixtures from a spec.
  Use when the user mentions pytest fixtures, conftest, or repeated test setup.
```

```yaml
# Meta: workflows/score-suite.md runs the audit; references/design-rubric.md holds 5-point rubric
name: test-design-critic
description: >
  Fix drifting test design by scoring fixture coupling, scope misuse, and suite speed.
  Use when the user asks to score, audit, or critique test design.
```
