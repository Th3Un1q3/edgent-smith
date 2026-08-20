# LinkedIn Company Page: Extract Growth-Chart Data Points

Extract the ~13 monthly chart points from the Growth-trends chart via the `[aria-label]` regex
`/^[A-Z][a-z]+ [0-9]{4},/` plus the Growth trends label.

Before reading, scroll the chart into view inside the inner MAIN scroll container (it is lazy-rendered);
`window.scrollTo` does NOT work on LinkedIn company pages - the page scrolls in an inner container,
not the window.

Related: mem:browser-automation/linkedin/company-page-growth-chart-route,
mem:browser-automation/linkedin/growth-percentage-sign-ground-truth.