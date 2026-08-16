# Indeed DE — jobs search results extraction

Verified 2026-08-14 via live DOM (devtools MCP) on https://de.indeed.com/jobs?q=Engineering+Manager&l=Deutschland&sort=date (new slider layout; old #jobsearch-ResultsList is gone).

## Results list (search page)
- Card: div[data-testid="slider_item"] (~16/page incl. mosaic/related tiles; real page size 10).
- Hierarchy: div[class^=mosaic-provider-jobcards-] > UL (hashed class) > LI > div.cardOutline > div[data-testid="slider_container"] > div.slider_list > div[data-testid="slider_item"].
- Title + job link: a.jcs-JobTitle inside h3.jobTitle. Attrs: data-jk=<jobKey>, id=sj_<jobKey>, href=/pagead/clk?mo=r&ad=...&vjs=3 (tracking URL). Canonical detail URL /viewjob?jk=<data-jk> verified live.
- Title text: a.jcs-JobTitle span (span[title=...]).
- Company: span[data-testid="company-name"].
- Location: div[data-testid="text-location"].
- Work-type attrs (Vollzeit/Gleitzeit...): li[data-testid="attribute_snippet_testid"].
- Date: NOT rendered on list page (zero date texts found in DOM; timing-attribute testid holds company+location here, not a date).
- Salary: none shown on sampled cards; when offered it appears as an attribute_snippet_testid item (UNVERIFIED — none observed).

## Detail page /viewjob?jk=<jk>
- JSON-LD: script[type=application/ld+json], @type JobPosting (~7 KB). Fields: datePosted (ISO), description (HTML), title, employmentType, hiringOrganization.name, jobLocation.address (country/region), validThrough, directApply. baseSalary absent on sampled job.
- Description fallback: #jobDescriptionText (innerText).

## Pagination
- Next: a[data-testid="pagination-page-next"] (aria-label Naechste Seite); adds &start=10 per page (page N = offset start=(N-1)*10). Page links: a[data-testid^=pagination-page].
- rel=canonical is site-level (/q-...-jobs.html), not per-job.

## Notes
- List page showed a transient Cloudflare Just a moment... interstitial that auto-resolved (no retry needed). Address-bar navigation to detail URLs worked without challenge.
- SPA: clicking a card updates the right detail panel [data-testid=vjJobDetails-test] in place.
- List-only fields: id (data-jk), title, company, location, attrs. description + datePosted require the detail page JSON-LD.