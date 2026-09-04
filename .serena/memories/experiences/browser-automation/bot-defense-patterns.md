---
id: experiences-browser-automation-bot-defense-patterns
type: experiences
hotness: 1.0
ttl: 90d
claim_ids: ["bot-defense-lazy-panel", "cache-verbatim-rule"]
L0: "Bot defense: lazy panels, stale guards, drift recovery"
---
# Experience — Bot-Defense & Lazy-Panel Extraction Patterns

9-check gate: pass — standalone (cross-site know-how), verified (from mem:browser-automation/automa/* and mem:browser-automation/general/bot-safe-extraction-lessons, 25 browser-automation leaves), reusable (checklist for any JS-heavy site), non-duplicative (first experience; aggregates cases), discoverable (via mem:experiences/about), right-size (3 paras), privacy (no PII), event-centric N/A, dedup: aggregates, not duplicates.

Sites that lazy-render panels (LinkedIn inner MAIN scroll, Automa drawflow) need: scroll inner container not window, wait for selector stability (500ms+), guard stale reads (re-query after tab close → active-tab rebind per mem:browser-automation/automa/active-tab-rebind-after-close-tab). Honeypot traps (Indeed/LinkedIn) flagged via hidden-fireclick per mem:browser-automation/automa/honeypot-defense-pattern.

Promoted from cases including mem:cases/browser-automation/linkedin-growth-chart plus browser-automation/general/bot-safe-extraction-lessons. For full recipe mechanics see mem:browser-automation/about Boundaries pointer to cases/*.
