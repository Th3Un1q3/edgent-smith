# No-Build Interactive Graph Visualization

For dynamic graph visualizations without a compilation step: one self-contained HTML file + vis-network (alternates: ECharts, cytoscape) from a pinned CDN (unpkg/jsDelivr) + graph data embedded as JSON in the page. Works from `file://` - no server, no build step.

`fetch()` from `file://` is blocked by CORS in all browsers - embed the data or require a local server. Used by memory-viz in this repo.