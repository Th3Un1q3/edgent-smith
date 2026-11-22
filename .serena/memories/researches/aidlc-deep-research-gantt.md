---
id: researches/aidlc-deep-research-gantt
type: researches
L0: "Readable Gantt of the deep-research design: 8 lanes, 33 rows, plain-word labels, loops as real rows with days, gaps g1-g5 kept."
freshness: 2026-11-21
provenance: mem:researches/aidlc-deep-research-design, 2026-11-21
version: 6
---

> Tables live in `researches/aidlc-deep-research-gantt-tables` (lane table, span table, time-unit arithmetic, assumptions, laziness patterns).

> **Digest.** Holds the Mermaid Gantt (17 steps, 8 check points, days counted in calls), the reader test, and the five disclosure gaps g1-g5.
> It is a PROPOSAL schedule over mem:researches/aidlc-deep-research-design: 8 lanes, 33 rows, loops as real rows, dates synthetic.
> Tables half - lane table, span table, time-unit arithmetic, assumptions, laziness patterns - lives in `researches/aidlc-deep-research-gantt-tables`.
> Read the reader test before quoting any date; the gaps list what the schedule invents.

# Gantt - one research question from brief to saved lesson (PROPOSAL schedule)

## The diagram

```mermaid
gantt
    title One research question from brief to saved lesson - 17 steps and 8 check points
    dateFormat YYYY-MM-DD
    axisFormat %b %d
    todayMarker off

    section Memory the run starts from
    Read org rules first - citation format and sources never to cite :milestone, mOrg, 2026-01-05, 0d
    Then read team memory - which channels proved reliable before :milestone, mTeam, after mOrg, 0d
    Then read project memory - decisions already taken on this topic :milestone, mProj, after mTeam, 0d

    section Frame the question
    Notes begin here - every step leaves what the next step reads :milestone, mNotes, after mProj, 0d
    Take in the brief - the one question and the decision it informs :s01, after mNotes, 2d
    Fix the scope - which steps run and which are skipped :s02, after s01, 3d
    Break the question into smaller ones - and say what evidence would settle each and what would prove it wrong :s03, after s02, 2d

    section Decide what proof looks like
    Pick the channels to search - what each costs and how old a source may be :s04, after s03, 2d
    List the first places to look - and give each a name that will not change :s05, after s04, 2d
    Decide what would count as proof - which claim needs which kind of source :s06, after s05, 2d
    Revision round - second look at the decisions so far, at most 2 times :crit, lm1, after s06, 2d

    section Gather and weigh the evidence
    Search until new sources stop adding anything :s07, after lm1, 3d
    Sort sources - shared origins grouped and copies flagged as not independent :s08, after s07, 5d
    Copy each useful passage out word for word - and note where it sits in the source :s09, after s08, 2d
    Put every claim in one list - one row each with copies merged and any claim with no source marked :s10, after s09, 2d
    Resume note saved in the run folder - a restarted run reads it to see where to carry on :milestone, mState, after s10, 0d
    Revision round - second look at the evidence, at most 2 times :crit, lm2, after mState, 2d

    section Write one answer per question
    Draft one answer per sub-question from the accepted claims :s11, after lm2, 2d
    Settle contradictions - none may stay open inside a delivered answer :s12, after s11, 3d
    Have someone who did not write the answers try to break them :s13, after s12, 2d
    Put the report together so every sentence can be traced to a claim :s14, after s13, 6d
    Revision round - second look at the answers, at most 2 times :crit, lm3, after s14, 2d

    section Check and date the report
    Resolve every citation to a live page or a saved copy :s15, after lm3, 4d
    Mark each source with when it was read and when it expires :s16, after s15, 4d

    section Checks that can stop or flag the run
    Copy check - flags two sources that are really the same for you to merge :milestone, gInd, after s08, 0d
    Contradiction check - flags any contradiction left open for you to settle :milestone, gCon, after s12, 0d
    Coverage check - flags sub-questions resting on one origin for you to widen or accept :milestone, gCov, after s14, 0d
    Every claim has a source - stops the report if one does not :milestone, gTr1, after s14, 0d
    Required headings present - flags a missing section for you to write :milestone, gSec, after s14, 0d
    The same check again before delivery - stops delivery if a claim lost its source :milestone, gTr2, after s15, 0d
    Every citation resolves - flags dead links for you to replace :milestone, gCit, after s15, 0d
    Sources still current - flags ones past their age limit for you to replace or accept :milestone, gFre, after s16, 0d

    section Memory the run leaves behind
    Revision round - last pass, saving one lesson and one decision, at most once :crit, mThird, after s16, 3d
```

## Reader test - what a stranger must be able to say

| Question | Answer the chart gives | Where it is answered |
|---|---|---|
| (a) What happens first, and why? | Three memory reads before any search, because the team's channel history and the project's earlier decisions decide where to look | First lane, all three rows |
| (b) What does deciding what proof looks like buy? | It fixes, before searching, which claim needs which kind of source, so search can stop when new sources dry up instead of when the searcher tires | Third row of the proof lane, then the search row after it |
| (c) How many answers get written, and from what? | One per sub-question - the brief allows at most five - each sentence tied to a claim in the one claim list | The smaller-questions row and the draft row |
| (d) Where is memory read, and where saved? | Read before anything else; the note marker opens the work, the resume marker sits where evidence closes, and the last revision saves | Lanes 1, 2, 4 and 8 |
| (e) Which check can stop the run? | One check, fired twice: before the report and before delivery | Checks lane, the two rows that say stops |
| How long, and what is expensive? | 55 days; putting the report together (6d) and sorting sources (5d) are the longest bars | Bar lengths against the axis |
| What repeats, and how often? | A revision round after three boundaries, at most twice each, and one last revision at the end | The four red rows, each labelled revision round |
| Which numbers are invented? | All durations, and the 2-round and 1-lesson caps are the design's; see g1-g5 | This document, not the chart |

## Gaps disclosed (a schedule invents what the design omits)

- g1 no inputs: the design declares outputs and exits only. Every dependency above is inferred from the previous row's output; the only edges it names are channel history into the channel choice and the recorded locator into citation resolution.
- g2 no durations: every day count comes from the call formula, not measurement. Change the formula and all 33 rows move; the order does not.
- g3 loop ranges unstated: the caps (3 per step, 2 per boundary, 1 per run) are the design's; one day per round is the schedule author's, which is why each revision round is 2d and the closing revision is 3d. The per-step three rounds are inside each step's own days, so they get no row.
- g4 check order unstated: three checks fire on the report row at one instant; the chart is honest about simultaneity but cannot show order or conjunction.
- g5 scope membership: the design proposes scopes of 6, 11, 17 and 7 steps without listing them and never places its skip marks. Only the deep scope is drawn; a smaller scope would delete rows, not compress them.
