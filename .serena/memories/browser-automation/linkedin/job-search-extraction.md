# LinkedIn Job Search Extraction (devtools MCP)

Extract job cards (title, description, apply URL) from LinkedIn job search without snapshots. Re-verified 2026-08-12 via live probe.

## Selectors (verified 2026-08-12)

- Card: div.job-card-container; job id in data-job-id (numeric). Fallback: any [data-job-id] or the title link's closest container.
- Title: a.job-card-list__title--link; title text lives in the anchor's strong (fallback: anchor textContent). Older a.job-card-list__title is stale (0 matches).
- Apply URL: title link href, pattern https://www.linkedin.com/jobs/view/{id}/?eBP=<tracking>; strip eBP for submission -> origin + pathname (https://www.linkedin.com/jobs/view/{id}/).
- Apply CTA: pane-level only, button.jobs-apply-button. aria-label 'Apply to {title} on company website' = external redirect; 'Easy Apply' = modal. No per-card apply button. Do not click it; submit the view URL instead.
- Pane title (wait anchor): .job-details-jobs-unified-top-card__job-title (text changes per card click). Pane meta (location/date/applicants): .job-details-jobs-unified-top-card__primary-description-container.
- Description: div.jobs-box__html-content, nested inside #job-details inside div.jobs-description__content. Heavy nested markup (br/li/strong observed) - use innerText for clean text (renders br/li as lines); textContent needs whitespace collapse. div.show-more-less-html__markup appears only on long descriptions.
- Card click target: the title link. Clicking replaces the pane (verified: pane title and description both changed). URL gains currentJobId={id} after click.
- Loading signal after card click: [class*=skeleton] (.app-boot-bg-skeleton observed).
- Totals: .jobs-search-results-list__text => '{keywords} in {region}' + '{count} results' (e.g., 812). Loop bound = min(X, count); count drifts between loads - re-read each run.
- Login wall: when logged in there are NO authwall selectors and no 'Sign in to LinkedIn'/'Join LinkedIn' copy. Branch: if #authwall-let-me-in/.authwall present OR 0 job cards => login wall, abort.

## Search URL template (parameterized)

https://www.linkedin.com/jobs/search?keywords={K}&f_TPR={R}&f_SAL={S}&position=1&pageNum=0 - LinkedIn strips position/pageNum and drops referralSearchId; filters live in URL params (address-bar tolerant).

## Pagination

In-page click mechanism - see mem:browser-automation/linkedin/jobs-pagination-mechanism.

## STRUCTURE DRIFT 2026-08-12 (same-day recheck, workflow-URL variant)

LinkedIn A/B-serves a HASHED-CLASS render (classes like f83b90b4/c64c6a20, zero semantic classes) on loads of BOTH the workflow URL (keywords+location+f_TPR+f_WT=2) and the draft URL (currentJobId+f_SAL+referralSearchId). On hashed renders ALL of these return 0: div.job-card-container, a.job-card-list__title--link, a.job-card-list__title, [data-job-id], .jobs-search-results-list__text, .job-details-jobs-unified-top-card__job-title, div.jobs-box__html-content, pagination selectors. Cards still render (titles/salaries/promoted markers visible in innerText) and ARE clickable, but as hashed divs WITHOUT anchor tags (card click triggers SPA navigation adding currentJobId + eBP blob). Network evidence of scraping protection: li.protechts.net (uc=scraping) + google recaptcha enterprise fire on these loads.

Stable anchors that SURVIVE hashing (observed 2026-08-12): data-testid attributes - [data-testid=lazy-column] (results list + pane), [data-testid=typeahead-input], [data-testid*=pagination] (pagination-controls-list, pagination-indicator-N, pagination-controls-next-button-visible), [data-testid=toasts-title]. Pane job link always present as a[href*=jobs/view] (pattern /jobs/view/{id}/?trackingId=..&refId=..&eBP=.. - eBP blob intact, confirmed via card click).

URL normalization (observed both variants): raw-space URL accepted (browser encodes to %20, 200 OK), then SPA rewrites location.href to canonical form - drops location & f_WT params, adds currentJobId={first-job-id}. No authwall redirect; filters still apply.

PROBE GATE FIX: class-based probes unreliable across renders. Recommended auth-gate probe pair (present on logged-in results, absent on authwall): (1) a[href*=jobs/view] (pane/job link - 1 on results page, 0 on authwall), (2) [data-testid*=pagination] OR text probe for /[0-9,]+ results/ (job-count text). Keep #authwall-let-me-in/.authwall as negative check. Prefer data-testid/href/text probes over class names.