# Dedup Verification: Grep Every Deduped Concept, Require Exactly-Once-in-Prose

Manual review misses leftovers that greps catch. After a dedup rework, probe every concept you consolidated — numbers (≤40), error strings, scheme names, section labels — and require EXACTLY ONE prose occurrence; pointer occurrences (numbered-entry or section-anchor refs) count as navigation, not duplication.

The browser-automation-devtools dedup (2026-08-13) left "≤40" twice — once as the kept pacing rule, once as a stale duplicate; manual review missed it, the grep caught it, and the file now carries exactly one occurrence (verified 2026-08-19). Build the probe list from the dedup plan itself: every concept you merged is a potential leftover.

Source: grep of the reworked file (2026-08-19) + rework context from operator.