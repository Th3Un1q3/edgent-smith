# Wellfound — Remote Engineering Manager Extraction

Site recipe for searching Engineering Manager jobs on wellfound.com via devtools (browser). Verification date: 2026-08-06.

## Access

- **403 on plain `fetch`** — devtools (browser) is the required path (operator-verified 2026-08-06).
- Search URL template: `https://wellfound.com/role/l/engineering-manager/germany` (also `?location=Germany` variant; both 403 on fetch).

## Results page structure (observed 2026-08-06)

- 49 results total: 29 rows (page 1) + 14 rows (page 2); only 4 rows are Engineering-Manager-title roles on page 1, zero on page 2.
- Job URL pattern: `https://wellfound.com/jobs/<id>-<slug>` — e.g. Secfix 4121670, Superchat 4248799, Leapsome 3537136, Ashby 2944353, Ledgy 4475463 (duplicate Ledgy 4147547), Zenjob EM Supply 4359682, "Manager, Engineering - Data Science" 4234285.

## Bot detection

- Trigger pattern observed: rapid consecutive full-page navigations (repeated new_page/navigate_page); in-page clicks at paced intervals do not. The exact observed alert signal text was NOT captured cleanly — **UNVERIFIED**.
- Selector claims are **UNVERIFIED** — re-probe with the snapshot-truncate-first procedure before reuse.

Related: mem:browser-automation/general/bot-safe-extraction-lessons