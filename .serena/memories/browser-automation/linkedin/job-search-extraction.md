# LinkedIn Job Search Extraction (devtools MCP)

Extract job cards (title, company, location, posted date, link) from LinkedIn job search without snapshots. Verified 2026-08-06 via live probe.

## Selectors (verified 2026-08-06)

- Card: div.job-card-container, job id in data-job-id. Title link: a.job-card-list__title--link (older a.job-card-list__title is stale). Title text lives in the anchor strong element (else anchor textContent); innerText duplicates on verified jobs, textContent does not.
- Company: .artdeco-entity-lockup__subtitle. Cards have NO time[datetime] except the selected card footer (.job-card-container__footer-item), so dates come from the details pane.
- Date and location: details pane .job-details-jobs-unified-top-card__primary-description-container, split on middle-dot separator gives [location, date, applicants]. Pane is server-rendered for the selected job (free); other cards need a click.

## Pattern

Search URL template (remote + last 7 days):
https://www.linkedin.com/jobs/search?keywords={KEYWORDS}&location={LOCATION}&geoId={GEOID}&f_WT=2&f_TPR=r604800&position=1&pageNum=0
Germany geoId=101282230.
One async evaluate_script: iterate cards, click title link, poll location.href change (deadline 4 s, sleep 120 ms), read pane, parse. About 200 ms per card. Verified in one call: 9 SPA clicks plus reads for 10 jobs (output 2.2 KB).

## Structured-source finding (verified 2026-08-06)

voyagerJobsDashJobCards endpoint (decorationId ...JobSearchCardsCollection-220) returns 403 CSRF check failed from fetch even with csrf-token header. /voyager/api/jobSearch returns 404. No JSON-in-DOM (no ld+json, no window.__data). DOM path is the reliable one.

## Re-verified 2026-08-06

- Selectors still valid (title--link count matched; no drift).
- pageNum=1 pagination did not advance results (same 11 cards, URL dropped pageNum); relaxing f_TPR reached more jobs (UNVERIFIED mechanism).
- PageId 1 is the LinkedIn tab; confirm by URL, fallback pageId 1.

Results cache: private/linkedin/remote-eng-manager-germany-2026-08-06 (private namespace — gitignored, never committed; 20 jobs).

Generic devtools mechanics (canonical copy in the skill): `workflows/browser-automation-devtools.md` + `references/devtools-known-issues.md`.