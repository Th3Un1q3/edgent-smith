# Workflow: Analyze Aspect

Filter a cached transcript through a user-supplied lens and weight the rubric.

When to load: when the user supplies a YouTube link plus an aspect — phrases like "focus on X", "through lens of Y", "aspect: testing".

Vocabulary: aspect — user-supplied focus that re-weights one rubric dimension 2x; excerpt — ≤2KB filtered preview; cache hit — existing file at cache path; dimension — one scored axis 0-2.

## Prerequisites

- Complete Steps 1-3 of [create-from-video.md](./create-from-video.md); reuse the cached transcript, do not re-fetch.
- Read [analysis-rubric.md](../references/analysis-rubric.md) for scoring and weighting rules.
- Read [skill-kinds.md](../references/skill-kinds.md) for Direct vs Meta synthesis.
- Follow [cache-transcript.md](../recipes/cache-transcript.md) for path and excerpt handling.

## Steps

### 1. Inherit Steps 1-3

Reuse [create-from-video.md](./create-from-video.md) Steps 1-3: extract videoId, probe cache, fetch only on miss via the standalone script. Do not duplicate cache logic.

```bash
uv run python .agents/skills/youtube-to-skill/scripts/fetch_transcript.py --video-id dQw4w9WgXcQ --format text --output cache/youtube/lex-fridman/how-i-built-x_dQw4w9WgXcQ.txt
```

Done when: verified transcript file exists at cached path (hit or freshly fetched via Steps 1-3).
Gate: No verified cache file, no Step 2.

### 2. Filtered Read

Expand the aspect into keywords (synonyms, sub-topics), scan the full transcript, return a ≤2KB excerpt for the prompt while preserving the full file for synthesis.

```python
keywords = expand_aspect("testing strategy")  # → ["test", "fixture", "coverage", "suite design"]
excerpt = find_relevant(transcript, keywords, limit=2000)  # head 1500 + tail 500
# full transcript stays at cache/youtube/...txt; excerpt is preview only
```

Done when: keyword-expanded scan completes; excerpt ≤2KB produced and full transcript path retained.
Gate: No keyword expansion and excerpt, no Step 3.

### 3. Apply Rubric Weighted 2x

Score 5 dimensions per [analysis-rubric.md](../references/analysis-rubric.md); double-weight the dimension matching the aspect. Report `Aspect "X" → Dimension Y (2x)`, raw 0-12 and renormalized 0-10.

```markdown
| Dimension | Score | Weight | Evidence (≤30w + [MM:SS]) | Why |
|---|---|---|---|---|
| Generality | 2 | 2x (aspect "testing") | "works for any pytest suite" [15:33] | Domain transfer |
| Teachability | 2 | 1x | "create conftest, define fixture" [08:21] | Ordered steps |
| **Total** | **10 raw → 8.3** |  | Verdict: Strong Direct |  |
```

Done when: 5 scores with evidence, weighted total, and mapping citation present.
Gate: No weighted score with mapping, no Step 4.

### 4. Kind-Specific Synthesis

Route synthesis by kind: technique evidence → Direct skill, reasoning/framework evidence → Meta skill, per [skill-kinds.md](../references/skill-kinds.md).

```yaml
# Direct — technique maps to replayable steps
name: pytest-fixture-builder
description: >
  Fix brittle setup by generating scoped fixtures.
  Use when the user mentions fixtures through lens of testing strategy.
# Meta — reasoning maps to critique lens
name: test-design-critic
description: >
  Fix unreviewed test design by scoring coupling through testing lens.
  Use when the user asks to audit suite design.
```

Done when: one paragraph explains which excerpts drove Direct vs Meta, and the weighted verdict selects the primary kind.
Gate: No kind-mapped synthesis with excerpt citations, do not present.

## Clarification Triggers

Ask the user before proceeding if:
- Aspect maps to two dimensions equally — ask which to double-weight.
- Excerpt captures <10% of transcript — ask to broaden keywords.
- Weighted total flips the verdict from Step 1-3 — confirm switch with user.

## Acceptance Criteria

- [ ] Steps 1-3 reused via cache path; no duplicate fetch on cache hit.
- [ ] Keyword expansion performed; excerpt ≤2KB with full file preserved.
- [ ] Rubric weighted 2x with explicit `Aspect → Dimension` mapping.
- [ ] Synthesis separates technique→Direct and reasoning→Meta with citations.
- [ ] Relative links to recipe and rubric resolve.
