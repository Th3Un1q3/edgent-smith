# Workflow: Analyze Violence (Jackal Diagnostic)

Score any message on the 4 NVC components to diagnose where Jackal leaks in.

When to load: user asks "analyze this for violence", "score my message", "where is the Jackal", or wants a 0–3 table before rewriting.

## Prerequisites

- Load [references/violent-patterns.md](../references/violent-patterns.md) for trap definitions, [references/rewrite-rubric.md](../references/rewrite-rubric.md) for 0–3 scale, [references/nvc-framework.md](../references/nvc-framework.md) for component criteria.
- Input: one message to score; optional: video anchor `cache/youtube-videos/nvc/l7TONauJGfc.txt`.

## Steps

1. **Isolate candidate spans** — split the message into clauses. Done when: each clause tagged as candidate observation, feeling, need, or request.
   - Example: "You have a big mouth, I feel manipulated, you never clean up" → three spans.

2. **Score observation 0–3** — apply camera test. Done when: observation score justified with quoted evidence.
   - 0 = evaluative label with no facts ("You are lazy"); 1 = mixed fact + evaluation ("You yelled"); 2 = mostly observable but vague time/place; 3 = exact words/time/place quotable.
   - Video anchor: "big mouth" (0) vs "said X at Y" (3); "yells" (0–1) vs "raised voice in hallway" (3); Lincoln High WHO YELLS pattern.

3. **Score feeling 0–3** — check real vs faux-feeling list. Done when: feeling score notes faux or real term.
   - 0 = faux-feeling that smuggles judgment ("rejected, abandoned, judged, misunderstood, manipulated"); 1 = vague "bad/upset"; 2 = close but blended with thought ("I feel I am not respected"); 3 = clean body feeling ("hurt, anxious, disappointed, frustrated, lonely, scared, angry").
   - Video anchor: faux list from workshop; real list replaces it.

4. **Score need 0–3 and request 0–3** — test need-as-strategy and demand traps. Done when: both scores have rationale.
   - Need 0 = strategy with "you" ("I need you to clean"); 1 = location-bound need ("I need the sink clean"); 2 = near-universal but still tied to action; 3 = universal without person ("serenity, order, respect, understanding").
   - Request 0 = negative demand ("don't break windows" — 38 windows story, no doable alternative); 1 = vague positive ("be more respectful"); 2 = concrete but no choice; 3 = positive, concrete, present, doable + "would you be willing to…?" + accepts no.
   - Video anchors: sink serenity (need), 38 windows and 11-year listen (request).

5. **Build the table and verdict** — output 4-row table with total /12. Done when: table rendered with pass/fail and next-step pointer.
   - Pass = total ≥10 no zero → ready to rewrite via [workflows/transform-message.md](./transform-message.md).
   - Fail = any zero or total ≤9 → rewrite the lowest component first.

## Examples

| Component | Example input span | Score | Notes |
|---|---|---|---|
| Observation | "You have a big mouth" | 0 | Evaluative label, no quotable words |
| Observation | "When you said 'I'll tell them' yesterday" | 3 | Exact quote + time |
| Feeling | "I feel manipulated" | 0 | Faux-feeling, smuggles "you manipulate me" |
| Feeling | "I feel anxious and hurt" | 3 | Body-based, no judgment |
| Need | "I need you to clean the sink" | 0 | Person-bound strategy |
| Need | "I need serenity and order in the kitchen" | 3 | Universal, no "you" |
| Request | "Don't break windows" | 0 | Negative, not doable (38 windows) |
| Request | "Would you be willing to play in the backyard?" | 3 | Positive, concrete, present, choice |

## Acceptance Criteria

- Table has 4 rows (Observation, Feeling, Need, Request) each with score 0–3 and evidence phrase.
- Total /12 computed and verdict (pass ≥10 no zero else fail) stated.
- At least one video anchor cited per failing component.
- Next step points to [workflows/transform-message.md](./transform-message.md) if fail or [recipes/quick-rewrite.md](../recipes/quick-rewrite.md) if pass.
