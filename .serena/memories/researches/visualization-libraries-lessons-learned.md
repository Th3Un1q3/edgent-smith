# Lessons Learned — Visualization Library Research (2026-08-21)

From the 20-candidate shortlist (GitHub data verified 2026-08-21): mem:researches/visualization-libraries-shortlist.

- **SVG beats canvas for static output**: SVG-rendering libraries win for PDF/static export — vector crispness, no raster scaling artifacts.
- **Dormant/abandoned — avoid**: ElGrapho, Rough.js, Remark, PyVis; Lottie slowing.
- **Licensing flags**: Highcharts/GoJS proprietary; GSAP free-tier; Remotion custom license (paid beyond small teams); JointJS MPL-2.0 (Rappid paid); bpmn-js custom license; Motion Canvas v3.18 alpha stalled since 2025-02.
- **vis-network**: in use in repo (v10.1.2), maintained, but 348 open issues + single-maintainer risk. Successor if richer layouts/vector export needed: Cytoscape.js. See mem:troubleshooting/web/no-build-graph-visualization.
- **Selection template validated**: candidate matrix over ease/maintenance/features/extensibility + media-fit tie-breaker worked well for cross-medium library research — reuse for future shortlists.