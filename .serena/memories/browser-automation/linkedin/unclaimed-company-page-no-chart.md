# LinkedIn Company Page: Unclaimed Companies Redirect /home and Show No Chart

Unclaimed company pages redirect `/company/<alias>/home` to the About view and render no
Growth-trends chart.

Record the entity as no-data WITH evidence (the redirect plus absence of chart) instead of
guessing or retrying other routes.

Related: mem:browser-automation/linkedin/company-page-growth-chart-route.