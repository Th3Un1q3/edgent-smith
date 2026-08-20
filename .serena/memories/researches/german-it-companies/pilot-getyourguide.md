# GetYourGuide - LinkedIn hiring trends pilot (2026-08-17)

Company: GetYourGuide (GetYourGuide AG), Berlin, Software Development. LinkedIn: linkedin.com/company/getyourguide-ag/ (verified via search-first).
Status: PIPELINE PROVEN - prior attempts reported no-data; data IS present, prior failure was parsing.

## Parsed values
- Growth trends: 13% (label: Employee growth; And more hiring trends present)
- Global employee count: 1K-5K employees (range format, no precise global total shown)
- Germany-only scope: 874 employees work in Germany (explicit line, distinct from global)
- Chart: Chart with 13 data points (Highcharts), X 2025-08-01 to 2026-08-01, Y range 1338 to 1517

## Monthly chart points (13)
- Aug 2025: 1,338
- Sep 2025: 1,349
- Oct 2025: 1,365
- Nov 2025: 1,390
- Dec 2025: 1,389
- Jan 2026: 1,404
- Feb 2026: 1,436
- Mar 2026: 1,448
- Apr 2026: 1,465
- May 2026: 1,501
- Jun 2026: 1,504
- Jul 2026: 1,504
- Aug 2026: 1,517

## Verbatim summary block (page text)
Growth trends
13%
Employee growth
And more hiring trends

## Scope notes
- 874 employees work in Germany = Germany-only headcount; global = 1K-5K employees range. Do NOT conflate.
- Chart series = total employees (final point 1,517 fits 1K-5K bucket), not Germany-only.
- Per-point labels live in aria-labels of chart points: e.g. August 2025, 1,338. Growth trends.; the a11y chart summary gives axis ranges only.
- Extracted 2026-08-17 via devtools on logged-in LinkedIn session; no bot alert. Chart lazy-renders; scroll + wait 4s required.
- Extractor recipe: find block containing Growth trends; grep [role=img]/[aria-label] inside the Chart with N data points container for monthly points.
