---
id: events-extraction-batch-linkedin-2026-08
type: events
hotness: 1.0
ttl: 90d
claim_ids: ["linkedin-growth-chart-selector", "cache-verbatim-rule"]
L0: "2026-08 batch: 47/50 LinkedIn charts captured"
---
# Batch LinkedIn Extraction — 2026-08-17 to 2026-08-19

9-check gate: pass — standalone (temporal batch log), verified (counts from mem:researches/german-it-companies/summary), reusable (replay extraction recipe), non-duplicative (first event; no prior events domain), discoverable (via mem:events/about), right-size (3 paras), privacy (public page data only), event-centric (source/outcome/next), dedup: new.

Source: LinkedIn company pages via devtools authenticated session; selectors per mem:browser-automation/linkedin/company-growth-chart-points-extraction and mem:browser-automation/linkedin/company-page-growth-chart-route (inner MAIN scroll, aria-label regex /^[A-Z][a-z]+ [0-9]{4},/). 47/50 live captures; 3 no-data (init SE unclaimed, msg/USU not found). Growth % direction fixed for 7 entries by comparing first/last chart points (see mem:researches/german-it-companies/lessons-learned).

Outcome: 51 entity leaves at mem:researches/german-it-companies/company-* indexed at mem:researches/german-it-companies/overview and aggregated at mem:entities/companies/german-it-sector. Evidence raw not cached as private PII? No — public counts stayed in researches. Next: sector watch cadence monthly, re-extract via same recipe; file as mem:events/extraction/batch-linkedin-YYYY-MM.
