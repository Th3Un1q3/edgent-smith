---
id: researches/aidlc-deep-research-gantt-tables
type: researches
L0: "Gantt tables for mem:researches/aidlc-deep-research-gantt: lane table (8 lanes, 33 rows), span table (33 rows), time-unit arithmetic, assumptions, laziness patterns."
freshness: 2026-11-21
provenance: mem:researches/aidlc-deep-research-gantt, 2026-11-21
version: 2
---

> Summary, Mermaid diagram, reader test and the five disclosure gaps live in `researches/aidlc-deep-research-gantt`.

> **Digest.** Holds the gantt's supporting tables: lane table (8 lanes, 33 rows), span table (33 rows), time-unit arithmetic, assumptions, laziness patterns.
> Days are calls, not calendar: the time-unit section fixes the axis and the arithmetic, and every calendar date is synthetic.
> Summary, Mermaid diagram, reader test and gaps g1-g5 live in `researches/aidlc-deep-research-gantt`.

# Gantt tables - lanes, spans, time unit

## Lane table (8 lanes, 33 rows)

| Lane | Rows | What it shows | Why it must be its own lane | Why it cannot be merged into a neighbour |
|---|---|---|---|---|
| Memory the run starts from | 3 | Three reads before any search: org rules, then team, then project | The order is a rule of the design, and a reader cannot see why the channel choices look the way they do without it | Merged into the first work lane, the reads look like preparation for step one instead of a precondition for every step |
| Frame the question | 4 | The note marker, the brief, the scope, and the smaller questions | The note marker opens the work it covers, and no step can start before the scope is fixed | Merged with the proof lane, no reader can tell that proof is decided after the question is fixed |
| Decide what proof looks like | 4 | Channel choice, first places to look, the definition of proof, then a revision round | This is what lets search stop on a rule instead of a hunch, and the revision corrects it before money is spent | Merged into gathering, the decision looks like something found during search instead of fixed before it |
| Gather and weigh the evidence | 6 | Search, sort, copy passages, one claim list, the resume marker, then a revision round | Four jobs with four costs (3, 5, 2, 2 days), and the resume marker sits exactly where the evidence phase closes | One bar would average the four costs away, and the boundary marker would have no place to sit |
| Write one answer per question | 5 | Draft, settle, break, assemble, then a revision round | This is where answers first exist, and the breaking row is the only one written by someone who did not draft | Merged with gathering, the boundary between evidence and prose disappears |
| Check and date the report | 2 | Citations resolved, dates stamped | The only lane whose rows can reject the whole artifact | Folded into writing, the check looks optional |
| Checks that can stop or flag the run | 8 | Each check as a moment, with what it looks for and whether it stops | Checks are events with a consequence, not work; only a lane of diamonds lets a reader count the one that stops a run | Inside a work lane a check becomes a day-long bar (fake duration) or a footnote (invisible) |
| Memory the run leaves behind | 1 | The closing revision, which saves the lesson and the decision | It is the only row that writes outside the run, and it takes days | Merged into the start lane, reads and writes blur, and the one-lesson-only rule is lost |

## Span table (33 rows)

| id | What the row says | Duration | Lane | Starts | Note |
|---|---|---|---|---|---|
| mOrg | Read org rules first - citation format and sources never to cite | 0d | Memory read | 2026-01-05 | the one anchor date; every other row hangs off this chain |
| mTeam | Then read team memory - which channels proved reliable before | 0d | Memory read | after mOrg | read second by rule |
| mProj | Then read project memory - decisions already taken on this topic | 0d | Memory read | after mTeam | read last, so project decisions win |
| mNotes | Notes begin here - every step leaves what the next step reads | 0d | Frame | after mProj | opens the work; the brief hangs off it |
| s01 | Take in the brief - the one question and the decision it informs | 2d | Frame | after mNotes | first work row |
| s02 | Fix the scope - which steps run and which are skipped | 3d | Frame | after s01 |  |
| s03 | Break the question into smaller ones - and say what would settle each | 2d | Frame | after s02 |  |
| s04 | Pick the channels to search - what each costs and how old a source may be | 2d | Proof | after s03 | uses the channel history read at mTeam |
| s05 | List the first places to look - and give each a name that will not change | 2d | Proof | after s04 |  |
| s06 | Decide what would count as proof - which claim needs which kind of source | 2d | Proof | after s05 |  |
| lm1 | Revision round - second look at the decisions so far, at most 2 times | 2d | Proof | after s06 | closes the lane; search hangs off it |
| s07 | Search until new sources stop adding anything | 3d | Gather | after lm1 | per-source repetition absorbed inside the row (A1) |
| s08 | Sort sources - shared origins grouped and copies flagged as not independent | 5d | Gather | after s07 |  |
| s09 | Copy each useful passage out word for word - and note where it sits in the source | 2d | Gather | after s08 | records the locator that s15 re-reads (A6) |
| s10 | Put every claim in one list - one row each with copies merged and any claim with no source marked | 2d | Gather | after s09 |  |
| mState | Resume note saved in the run folder - a restarted run reads it to see where to carry on | 0d | Gather | after s10 | sits where evidence closes; the revision hangs off it |
| lm2 | Revision round - second look at the evidence, at most 2 times | 2d | Gather | after mState |  |
| s11 | Draft one answer per sub-question from the accepted claims | 2d | Write | after lm2 | needs the claim list closed (A5) |
| s12 | Settle contradictions - none may stay open inside a delivered answer | 3d | Write | after s11 |  |
| s13 | Have someone who did not write the answers try to break them | 2d | Write | after s12 |  |
| s14 | Put the report together so every sentence can be traced to a claim | 6d | Write | after s13 |  |
| lm3 | Revision round - second look at the answers, at most 2 times | 2d | Write | after s14 | a redo here voids the sections and the trace below (A6) |
| s15 | Resolve every citation to a live page or a saved copy | 4d | Close | after lm3 | needs the locator recorded at s09 |
| s16 | Mark each source with when it was read and when it expires | 4d | Close | after s15 |  |
| gInd | Copy check - flags two sources that are really the same for you to merge | 0d | Checks | after s08 |  |
| gCon | Contradiction check - flags any contradiction left open for you to settle | 0d | Checks | after s12 |  |
| gCov | Coverage check - flags sub-questions resting on one origin for you to widen or accept | 0d | Checks | after s14 |  |
| gTr1 | Every claim has a source - stops the report if one does not | 0d | Checks | after s14 | first firing of the only stopping check |
| gSec | Required headings present - flags a missing section for you to write | 0d | Checks | after s14 |  |
| gTr2 | The same check again before delivery - stops delivery if a claim lost its source | 0d | Checks | after s15 | second firing of the same check |
| gCit | Every citation resolves - flags dead links for you to replace | 0d | Checks | after s15 |  |
| gFre | Sources still current - flags ones past their age limit for you to replace or accept | 0d | Checks | after s16 |  |
| mThird | Revision round - last pass, saving one lesson and one decision, at most once | 3d | Memory write | after s16 | this row is the harvest step, not a copy of it |

## Time unit (one rule, then arithmetic)

The design budgets work in calls per step, never in days (gap g2). One budget day is one call:

    calls(step) = 1 protocol turn + 1 per declared output + 1 per check firing at that step
    duration = calls(step) days

Dates are synthetic, anchored 2026-01-05, consecutive, no weekends (A2); only spacing is meaningful. Three derivations a reader can redo: putting the report together = 1 turn + 2 outputs (report, trace) + 3 checks = 6d; sorting sources = 1 + 3 (origin group, independence, quality) + 1 check = 5d; listing the first places to look = 1 + 1 output = 2d. Revision arithmetic: each of the three revision rounds is 2d, one day per allowed round, adding 6d; the closing revision is 3d, one day per saved write plus the turn. Total 46 work days in the sixteen steps + 6 days of revision rounds + 3 days of closing revision = 55, 2026-01-05 to 2026-03-01.

## Assumptions

- A1 concurrency: the design states repetition but not parallelism; fan-out over sources and sub-questions stays inside the search and draft rows. The schedule author serialises nothing into extra rows.
- A2 calendar: consecutive synthetic days; exactly one row carries the anchor date because a chart needs a root, and every other row derives from it by dependency; no weekends, no wall clock.
- A3 check cost: one day per check, folded into the step it fires on, so a check is a diamond and never a bar.
- A4 scope: deep only; skipped rows are absent rather than zero-length.
- A5 stated sequence: the claim list closes before answers are drafted, and citations resolve before dates are stamped; both drawn as dependencies, not prose.
- A6 redo cost: a second pass consumes its 2 days; the rework it voids is not drawn, and that cost sits in g3.
- A7 caps: 3, 2 and 1 are round counts; only the boundary and per-run caps become days, because only they have a stated unit of one pass.

## Laziness patterns and how each was prevented

Audit the chart against this list; each line gives the failure, its tell and the check that kills it.

- [ ] Syntax from memory - writing id-in-brackets because flowchart Mermaid looks like that. Tell: labels render with their own ids. Prevention: label-first lines only, no colon or comma in a label, and a parse before shipping.
- [ ] Jargon label - a row named after an internal artifact ("register", "ledger", "offsets", "red-team") instead of an act. Tell: a label a stranger cannot act on. Prevention: every label starts with a verb and says what the row produces or decides.
- [ ] Overlay lane - a lane of long bars that add no days and feed nothing, repeating work rows. Tell: a bar spanning the whole run that no row depends on. Prevention: every row is work, a check, or a save; a repeating row must consume its own days.
- [ ] Two gates where one fires twice - counting the same check as two different checks. Tell: two rows with near-identical wording. Prevention: the second row says it is the same check again.
- [ ] Invisible memory - memory mentioned nowhere although the run depends on it. Tell: no row says what is read or written. Prevention: three read rows, a note marker, a resume marker and a closing revision, each reached by one row and reaching the next.
- [ ] Floating marker - a zero-day row pinned to its own date with nothing before or after it. Tell: a diamond whose date no other row references. Prevention: every marker sits inside the chain, so one row hangs off it and it hangs off another.
- [ ] Crushed bars - all work squeezed to one edge or a single pixel. Tell: an axis running past the plan's end. Prevention: every work row 1 day or more, chained so bars step across the calendar.
- [ ] Stranded diamonds - milestones floating with no host row. Tell: a diamond with no bar before or after it. Prevention: every check is attached to the step it checks.
- [ ] Phase-bar collapse - one bar per phase because 17 rows are tedious. Tell: a bar named after a lane. Prevention: 16 work rows in 5 lanes plus the closing pass, counted 3+3+4+4+2.
- [ ] Round-number spans - durations picked to look tidy. Tell: every bar a multiple of 7. Prevention: one call formula and three worked derivations.
- [ ] Invented counts - stating how many sub-questions or answers without the design saying so. Tell: a number in a label that no design line supports. Prevention: "one per sub-question", with the design's at-most-five kept in the reader test only.
- [ ] Gap laundering - a confident schedule hiding five unspecified things. Tell: no disclosure section. Prevention: g1-g5, each tied to the rows it would move.
- [ ] Fake precision - synthetic dates read as a forecast. Tell: a reader quoting 2026-02-16 as a commitment. Prevention: the time-unit section says the axis is calls, and A2 says the calendar is synthetic.
