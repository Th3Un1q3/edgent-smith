---
id: cases-browser-automation-linkedin-growth-chart
type: cases
hotness: 1.0
ttl: 90d
claim_ids: ["linkedin-growth-chart-selector"]
L0: "LinkedIn growth chart: aria-label regex extraction"
---
# Case — LinkedIn Growth-Chart Points Extraction

9-check gate: pass — standalone (one extraction problem), verified (against mem:browser-automation/linkedin/company-growth-chart-points-extraction and 47 live captures), reusable (paste-able selector), non-duplicative (first case; recipe remains in browser-automation), discoverable (via mem:cases/about), right-size (2 paras + bullets), privacy (no PII, public chart), event-centric (derived from mem:events/extraction/batch-linkedin-2026-08), dedup: extracted not duplicated.

Problem: LinkedIn renders Growth trends chart lazily inside inner MAIN scroll; window.scrollTo misses it and a11y tree lacks counts. Solution: scroll inner container into view, wait 4s, grep [role=img]/[aria-label] nodes matching /^[A-Z][a-z]+ [0-9]{4},/; growth % label is absolute — direction must be computed last-first chart point (fixes 7 sign errors). See mem:researches/german-it-companies/lessons-learned and mem:claims/linkedin/growth-chart-selector-claim for evidence.
