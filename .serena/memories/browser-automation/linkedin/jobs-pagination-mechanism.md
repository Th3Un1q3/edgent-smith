# LinkedIn Jobs Pagination Mechanism (devtools MCP)

Verified 2026-08-12 by live click. pageNum=1 URL param does NOT advance results; the working mechanism is an in-page click on the Next button.

## Controls (render inside the results scroller below the cards, after the list loads)

- Next: button[aria-label='View next page'] (text 'Next'). VERIFIED: click advanced page 1->2, first card id changed, URL gained &start=25, page-state updated.
- Previous: button[aria-label='View previous page'].
- Page buttons: button.jobs-search-pagination__indicator-button, aria-label='Page N'. Active indicator: class jobs-search-pagination__indicator-button--active + aria-current='page'.
- Page state: p.jobs-search-pagination__page-state => 'Page N of M' (current + total in one selector).
- Container: div.jobs-search-pagination (also .jobs-search-results-list__pagination; ul.jobs-search-pagination__pages; li.jobs-search-pagination__indicator).

## End of pagination

On the last page the Next button is REMOVED from the DOM (not disabled). Detect via querySelector('button[aria-label=View next page]') === null, or page-state current == total ('Page 37 of 37' observed).

## Behavior notes

- URL paging param: start = (page-1)*25 (25 results/page; last page partial, e.g., 12 cards).
- Total pages/results fluctuate between loads (33 vs 37 pages for the same query) - never hardcode M; read page-state or totals text each run.
- Legacy artdeco-pagination (li.artdeco-pagination__indicator, button[aria-label='Next']) NOT present on the current UI - fallback only.
- The card list caps at ~25 DOM cards per page; scrolling loads up to 25 but does not recycle beyond the loaded page.