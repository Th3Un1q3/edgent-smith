---
id: claims-linkedin-growth-chart-selector-claim
type: claims
hotness: 1.0
ttl: 90d
claim_ids: ["linkedin-growth-chart-selector"]
L0: "LinkedIn growth chart needs aria-label regex"
---
# Claim — LinkedIn Growth-Chart Selector Requires aria-label Regex

9-check gate: pass — standalone (atomic selector claim), verified (47/50 live LinkedIn captures via mem:researches/german-it-companies/summary and recipe mem:browser-automation/linkedin/company-growth-chart-points-extraction), reusable (direct selector), non-duplicative (first LinkedIn claim), discoverable (via mem:cases/browser-automation/linkedin-growth-chart), right-size (2 paras), privacy (public chart), event-centric N/A, dedup: new.

Statement: Growth-trends chart points are extracted via aria-label regex /^[A-Z][a-z]+ [0-9]{4},/ inside inner MAIN scroll after lazy-render wait; growth % text is absolute — direction must be computed last-first point (7 sign fixes). Confidence: high — validated across 13-point series Aug 2025→Aug 2026 per mem:researches/german-it-companies/lessons-learned.

Evidence: mem:browser-automation/linkedin/company-growth-chart-points-extraction; mem:researches/german-it-companies/pilot-getyourguide (13 points: Aug 2025 1338 → Aug 2026 1517); mem:researches/german-it-companies/lessons-learned chart-point ground-truth section.
