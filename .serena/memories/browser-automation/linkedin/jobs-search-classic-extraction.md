# LinkedIn Classic Jobs Search (/jobs/search/) Extraction (devtools MCP)

Live-verified 2026-08-13 (gateway devtools, operator session). Classic artdeco render of /jobs/search/ - the OPPOSITE of the hashed data-testid render: zero [data-testid], zero [componentkey]. URL stays /jobs/search/ through card clicks and pagination.

## Variant detection
- Classic: location.pathname === /jobs/search/ (no data-testids anywhere; div[data-job-id] cards).
- New: /jobs/search-results/ + data-testid anchors (see mem:browser-automation/linkedin/job-search-extraction).

## Layout
- Two-pane scaffold: div.scaffold-layout.scaffold-layout--list-detail (x=264 list col w~503, x=768 pane w~624).
- LEFT list scroll container: hashed class (e.g. VAnvNymswPClnUgkWpEuWevPqqgrITgM), no testid, scrolls internally.
- RIGHT pane scroll container: .jobs-search__job-details--wrapper (overflow-y:auto). Window does NOT scroll (body overflow-y:scroll, html visible).

## Cards
- div[data-job-id] (numeric id) = card container; class job-card-container job-card-container--clickable.
- Title: a.job-card-list__title--link (11 per initial load), href /jobs/view/{id}/?eBP=NON_CHARGEABLE_CHANNEL&refId=...; strip query for submit URL.
- NO componentkey attrs; NO Dismiss buttons on cards (5 Dismiss buttons are artdeco-hoverable-content__close-btn tooltips - NOT cards).
- Initial DOM ~11 cards of ~25; scrolling the list col loads more (11->24, skeletons [class*=skeleton] appear).

## Description (COMPLETE - no collapse)
- Container: #job-details = div.jobs-box__html-content, parent div.jobs-description__content > article.jobs-description__container.
- About marker: H2.text-heading-large About the job (About the role/About this job variants expected), FIRST heading inside #job-details. Slice from marker.
- NO button[data-testid=expandable-text-button], NO .show-more-less-html__markup on classic. Description renders complete.
- Show-more buttons present ONLY in company section: button.inline-show-more-text__button (outside #job-details).
- Pane title: .job-details-jobs-unified-top-card__job-title (DIV, not anchor). Pane job anchor match: 2x a[href*=jobs/view] inside pane for current id (apply links).
- Loading signal after card click: [class*=skeleton].

## Pagination (same component both variants)
- Container .jobs-search-pagination; page-state p.jobs-search-pagination__page-state = Page N of M (loop bound).
- Next: button[aria-label=View next page] (class jobs-search-pagination__button--next, inner span.artdeco-button__text Next) - workflow XPath //button[.//span[text()=Next]] VERIFIED matches.
- Prev: button[aria-label=View previous page]. Page btns: button.jobs-search-pagination__indicator-button aria-label Page N, active = aria-current=page.
- Click Next adds &start=25 (page-1)*25; URL stays /jobs/search/; first card id changes. No Next button in DOM on last page (not disabled) / single-page queries render only Page 1.

## Filters / sort / auth
- Sort: button.reusable-search-filter-trigger-and-dropdown__trigger artdeco-pill--selected, text Most recent for sortBy=DD; aria-label Sort by filter. Most recent filter is currently applied.
- Chips: artdeco-pill artdeco-pill--selected search-reusables__filter-pill-button; Past week (aria Date posted filter...), Remote N (aria Remote filter...). geoId lives as location input value Germany (input#jobs-search-box-location-id-emberNN), NOT a pill.
- Auth probe: button.jobs-save-button > span.jobs-save-button__text Save (exact span text Save verified).
- Address-bar tolerant (navigate_page with relaxed params OK; SPA rewrites canonical URL, adds currentJobId of first card).

## Diffs vs search-results variant
- lazy-column detection: classic has NO lazy-column; use .jobs-search__job-details--wrapper + #job-details.
- componentkey card XPath: 0 matches classic; use div[data-job-id].
- Dismiss-branch: classic Dismiss buttons are tooltip close buttons - do not use as card selector.
- expandable-text-button: N/A classic (complete text).
- Next XPath + About marker + Save probe: SAME, both variants.