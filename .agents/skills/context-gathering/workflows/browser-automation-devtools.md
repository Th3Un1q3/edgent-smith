# Workflow: Browser Automation with the devtools MCP Server

Drive the host Chrome through the devtools MCP server via the gateway: navigate, extract, and script SPA flows. Per-site knowledge lives in memories — extraction memory at `mem:browser-automation/<site>/<task>-extraction` (public — verified selectors, URL templates, quirks) and dated result caches at `mem:private/<site>/<task>-<YYYY-MM-DD>` (private — session-derived). Read the target site's namespace before starting — `list_memories({topic: 'browser-automation/<site>'})` and `list_memories({topic: 'private/<site>'})`, reading each domain's `about` first ([serena-memory recall](../../serena-memory/workflows/recall-memory.md); call shapes in [serena-memory lifecycle](../../serena-memory/references/lifecycle.md)).

Full loop: activate → verify auth → navigate → extract → cache → memorize selectors → recover from drift.

## Principles

- **Return only needed fields.** One `evaluate_script` per logical unit; never `take_snapshot` during extraction (Steps 4–5).
- **Persist verified selectors** in the site's extraction memory, stamped with the verification date (Step 8).
- **Expect selector drift.** Probe a sentinel first, keep recorded fallbacks, prefer cheap re-derivation over heroic parsing (Step 9).
- **Reuse the operator's authenticated session.** Auth missing or login wall → STOP and escalate; no aggressive retries, no automated login (Step 2).
- **Cache with freshness TTL.** Check dated private caches before re-extraction; checkpoint partials as you work (Step 7) — see [serena-memory lifecycle](../../serena-memory/references/lifecycle.md) for TTL budgets.
- **Pace actions** per [Shared rules](#shared-rules-and-helpers) (Step 6).
- **Fail fast.** In-script error handling and bounded fallbacks; if none work, stop and report instead of looping (Step 11).
- **Escalate, don't workaround.** When the devtools server — the designated source of truth for live-page DOM evidence — is down, stop after bounded retries and escalate; never silently substitute tools that change the source of truth.

## Source of truth down — ESCALATE, don't workaround

When a task designates a specific source of truth (for us: the devtools server for live-page DOM evidence) and that source is DOWN or unreachable:

- **Retry, bounded.** Gateway attach is transiently flaky — on "Not connected" or an empty tool list, retry up to **2×** before concluding anything (devtools-known-issues #20). The 2× cap bounds every tool/target pair across the whole session ([truncation-examples §D](../references/truncation-examples.md)).
- **Then stop and escalate.** Report the exact blocker — which tool, what error, what config — and ask the operator to restart the host proxy/service (`.devcontainer/init.sh`) or re-attach the session. Never silently substitute tools that change the source of truth: direct HTTP fetch (urllib/requests/curl), tavily, search APIs, or web archives. Workaround tools yield different data and corrupted evidence — rendered markdown ≠ real DOM (e.g., a "Show more" button that exists only in markdown, or a job count that disagrees with the filtered live page).
- **Verify down before declaring down.** Attempt the actual tool path (`gateway_mcp-find` → `gateway_code-mode` → `gateway_mcp-exec` against the devtools server) and observe ≥2 real timeouts/errors on real tool calls before reporting the server down. Log files, port scans, or indirect evidence alone are NOT sufficient. After an operator reports a restart, re-probe rather than trusting a prior down-verdict. Never assert or premise a report on "the server is down" without ≥2 observed timeouts on real tool calls.
- **Write prompts around the gotchas** ([devtools-known-issues](../references/devtools-known-issues.md) #20–22): retry transient attach flakiness, split navigation and evaluation across calls (#22), and write scripts with zero backslashes and zero double quotes (#21).

## Prerequisites

- Complete the [Setup workflow](./setup.md) to activate a code-mode sandbox with the `devtools` and `serena` servers.
- Follow the [Scripting workflow](./scripting-workflow.md) for synchronous-JS rules, quoting, and error handling.
- The devtools MCP server must be attached to the operator's host Chrome with an authenticated session (logged-in cookies). Never attempt to log in.
- **`filePath` is always DENIED.** The server runs on the HOST (launched by `.devcontainer/init.sh`); its filesystem is the host's, so container paths (`/tmp/...`, `/workspace/...`) do not exist there and host-side writes are unreadable from this container. Every file-writing tool (`take_snapshot`, `evaluate_script`, `take_screenshot`) refuses a `filePath`; all devtools data returns INLINE or not at all (devtools-known-issues #19).

## Steps

**1. Activate the sandbox.** Activate code-mode with only `devtools` + `serena` and a descriptive, task-related name (`code-mode-<site>-<task>`). Keep the server set minimal — adding servers later costs a re-activation.

**2. Verify authentication first.** Call `list_pages()` and inspect the markdown table; locate the operator's session tab by URL. Detect a login wall: the URL redirects to a login page, or the page renders only login prompts. Auth missing or login wall → **STOP** and escalate ([Clarification Triggers](#acceptance-exit-and-clarification)). No session tab ≠ unauthenticated: session cookies live in the devtools server's shared default context, not in a named tab. A valid auth check without a session tab: `new_page({url: '<target-url>'})` WITHOUT `isolatedContext` (devtools-known-issues #6) and probe for a login wall. **The auth probe IS the navigation** — this `new_page` opens the target once; do not call `new_page` again for the same URL.

**3. Navigate.** Open the target with `new_page({url: '<target-url>'})` — exactly once during setup: Step 2's auth probe IS this open, so do not open the same target URL twice during setup. The once-rule guards the auth-probe + D1 open pair only; it does NOT forbid the batch recipe's intentional re-open of entity 1 during smoke-test-then-loop — the batch flow re-opens entity 1 by design (`new_page` returns a plain markdown pages table, not a page id — do not unwrap it; [D1](../references/snippets.md#d1-open-page-and-probe) implements the open + load-probe pattern with a LIGHT embedded probe, devtools-known-issues #11). After every navigation — this open and every cross-URL move — RE-INSTALL the page helpers [X](../references/snippets.md#x-install-helpers-once-per-page-load): `new_page` destroys the JS realm, so the order is `new_page` (D1) → re-install X → then D2/paginate/extract. Two movement types:

- **Intra-page (SPA):** every movement is a click (by text or recorded selector) inside `evaluate_script` — pagination, filters, "load more", tabs, cards. Click, don't re-URL.
- **Cross-URL (distinct resources):** list result → item detail, company → profile: paced `navigate_page`. Address-bar navigation is tolerated on some sites and triggers bot detection on others (devtools-known-issues #17); record the site's **address-bar tolerance** in the extraction memory. Pace per [Shared rules](#shared-rules-and-helpers); shortest path (one hop, not a chain of reloads).
- **Batch research (5+ entities):** use the [batch recipe](../recipes/batch-browser-automation.md) — search-first navigation, extractor smoke-testing, chunking, and per-batch caching.

**4. Structure discovery — targeted query, not snapshots.** No extraction memory yet: discover with a TARGETED `evaluate_script` returning only the nodes containing the needed text — [discover](../references/snippets.md#discover-targeted-structure-discovery) (`{tag, text, href, class}` filtered on `textContent`) — cheap, precise, no context flood. Only if the embedded-source probe fails may you take ONE `take_snapshot` — **inline only** (never `filePath` — #19), truncated to ~2 KB IN-SCRIPT before returning ([truncation-examples §A](../references/truncation-examples.md)). The snapshot-before-evaluate rule is CONDITIONAL: it applies only when that workaround fails — an `evaluate_script` on a snapshot-less page can fail with `No snapshot found for page N` (devtools-known-issues #13); the D1 embedded probe (Step 3) is the preferred pattern and needs NO snapshot. This is the ONLY permitted use — one per unfamiliar flow, never during extraction (Step 5). For interactive structure, prefer [A](../references/snippets.md#a-list-clickables) (clickables), [B](../references/snippets.md#b-filter-clickables) (filtered clickables), [C](../references/snippets.md#c-list-inputs) (inputs).

**5. Extract with minimal output.** One `evaluate_script` per logical unit; return only the fields the site's extraction memory records. Never `take_snapshot` during extraction. Trim and aggregate IN-SCRIPT — `map` to objects, `join` arrays, cap the return — so oversized payloads never reach the model ([Shared rules](#shared-rules-and-helpers)); stay lean from the start and re-run with tighter caps rather than dumping raw DOM. Parse every return through [`unwrap`](../references/snippets.md#unwrap); for minimal field extraction use [SELECTOR](../references/snippets.md#selector-minimal-extractor). Before applying an extractor to a batch, smoke-test it against the first entity ([Shared rules](#shared-rules-and-helpers)).

**6. SPA interactions.** Click-wait-read flows inside ONE async `evaluate_script`: click a list item, bounded-poll the href for change, read, continue — [D2](../references/snippets.md#d2-list-click-and-relist) packages the list → click → re-list pattern in one async call; generic pagination uses [paginate](../references/snippets.md#paginate-generic-pagination-loop) — site-specific control selectors (e.g., LinkedIn's `mem:browser-automation/linkedin/jobs-pagination-mechanism`) override its generic detection. Pace per [Shared rules](#shared-rules-and-helpers) (site memory may tune). Watch for bot-alert signals after every action; on detection: STOP, checkpoint partials, report. Use the effect-verified click companion [B2](../references/snippets.md#b2-effect-verified-click) — `WARNING` semantics per [Shared rules](#shared-rules-and-helpers). Where filters mirror URL params (e.g., LinkedIn `f_WT`/`f_TPR`), a synthetic click on a React-controlled hidden input may be silently ignored: if a click shows no effect, ONE bounded `navigate_page` with the param set is acceptable; record the site's address-bar tolerance (`mem:browser-automation/linkedin/job-filter-param-click-workaround`).

**7. Cache results — checkpoints as you work.** Two artifacts, one final. **Task result cache** — ONE dated memory `mem:private/<site>/<task>-<YYYY-MM-DD>`: check it before extracting (`list_memories({topic: 'private/<site>'})` via [serena-memory workflows](../../serena-memory/workflows/recall-memory.md); helpers: [serena-memory lifecycle](../../serena-memory/references/lifecycle.md)); each dated memory records its TTL — see [serena-memory lifecycle](../../serena-memory/references/lifecycle.md) for budgets; fresh hit → skip re-extraction. Write every intermediate result AS WORK PROCEEDS — after each search/results list, page, category — into that SAME dated memory; never wait for the end (an early stop still leaves partials persisted). It IS the final result: partials and full result live in one memory — UPDATE it, never write a second one. **Batch checkpoints** — INTERMEDIATE progress memories `mem:private/<site>-research/batch-<N>-<YYYY-MM-DD>` written per batch by the [batch recipe](../recipes/batch-browser-automation.md); consolidated into the task cache at the end, then archived. Names may drift in the store — list + pattern-match, never assume exact names. A dated cache with a MISSING TTL field is treated as STALE — re-verify before reusing. Caches are session-derived → private by default; extraction memory holds no PII and stays public. Partial-cache rule: a fresh dated cache may hold fewer results than required — if it covers the task's count, skip; else re-extract the gap and UPDATE the same memory, never a second one.

**8. Store/refresh selectors.** Maintain the site's extraction memory: verified selectors, verification date stamp, primary + stale/fallback selectors (sites A/B test class names; superseded ones become fallbacks). Run the [BLOCKING GATE](../../serena-memory/references/gating.md) before every write.

**9. Drift recovery.** Run the sentinel drift probe [probe](../references/snippets.md#probe-sentinel-drift-probe) (one cheap `evaluate_script` returning `{found, count}`) before trusting stored selectors. Empty/wrong fields → recorded fallbacks; then re-derive cheaply: dump ONE item's relevant nodes only — never the whole page — identify current classes, update the extraction memory with a new verified date. Heroic parsing of full DOM dumps is the last resort.

**10. Anti-bot protocol.** Bot-alert signals: CAPTCHA iframe, "verify you are human" copy, 403 alert page, blocked/rate-limit copy. On any signal: STOP all actions immediately → write partials to `private/` (Step 7 checkpoints hold most already) → report signal + cached state to the operator. No retries, no looped `new_page` — address-bar navigation is itself a bot signal (Step 3).

**11. Fail fast.** Retries are bounded and in-script only; each attempt differs from the last — never retry the same failing script. `require is not defined` / `Invalid or unexpected token` mean rewrite as browser JS, not re-run (devtools-known-issues #23). Escalate per-entity extraction failures through the fallback ladder ([Shared rules](#shared-rules-and-helpers)). Script error and no recorded fallback → **stop** and report, including the raw partial response for diagnosis. Never loop.

## Battle-test lessons

- **`:has()` resolves to the OUTERMOST ancestor:** prefer `parentElement`/`closest()` ancestor stepping; zero-size inputs signal the real clickable is an ancestor.
- Site-specific lessons live in memory, not here: `mem:browser-automation/linkedin/` (names listed in [Site-specific memories](#site-specific-memories)) and `mem:browser-automation/general/batch-checkpoint-template`.

## Acceptance, Exit and Clarification

### Acceptance
- Sandbox activated with `devtools` + `serena` only, under a descriptive name.
- Auth verified via `list_pages` before any navigation; login wall → STOP and escalate.
- Structure discovery used a targeted `evaluate_script` first; any `take_snapshot` was inline and truncated in-script — one per flow, never for extraction.
- Extraction returned only needed fields, capped per [Shared rules](#shared-rules-and-helpers), parsed via [`unwrap`](../references/snippets.md#unwrap).
- Intra-page moves were clicks; cross-URL moves paced per [Shared rules](#shared-rules-and-helpers) with the site's address-bar tolerance recorded.
- Results checkpoint-cached in dated `private/` memories with a TTL; fresh hits skipped re-extraction.
- Extraction memory stamped with a verification date and fallbacks; [BLOCKING GATE](../../serena-memory/references/gating.md) run before every write.
- On drift, a fallback or cheap targeted re-derivation resolved it; the memory was updated.
- Bot-alert STOP sequence executed and partials cached, if any alert occurred.
- Fail-fast path executed (STOP + report) whenever no fallback worked.
- Interactive-element discovery used the [snippet library](../references/snippets.md) (A–D): clickables listed with a limit, filtered by type/text with self-verified unique selectors, effect-verified clicks (WARNING on no state change), inputs filtrable with visibility flags, and the combined navigate+list flow.

### Exit
- Task data is extracted, cached, and — where applicable — the extraction memory is current.
- No operator tabs were touched beyond reading `list_pages`.
- If extraction stopped early: the operator received the raw partial response and a clear reason.

### Clarification Triggers (STOP — ask the operator before)
- Touching or navigating tabs the agent did not create; any action that might log the session out (navigating the session tab away from authenticated domains, closing it).
- Auth missing or a login wall (Step 2), or any bot-alert signal — report it immediately with the signal and the cached partials (Step 10).
- Batch runs longer than N items, or exceeding the per-task action budget — N = the count of entities/results the operator requested; confirm the exact N first (required when the batch would exceed a known N, or when N is unknown — "~20" needs the exact count before starting).
- The source of truth is down after the 2× bounded retry — escalate with the exact blocker; never substitute tools (Source-of-truth section above).

## Shared rules and helpers

- **3 KB cap:** every return is hard-capped — `LIMIT`/`MAX_TEXT` cap the data and the wrappers return `JSON.stringify(result).slice(0, 3000)` ([truncation-examples §C](../references/truncation-examples.md)); the cap stays inline in the snippets because it is part of the return protocol.
- **Pacing & action budget:** ≥1 s between distinct actions, ≥250 ms between in-page transitions, bounded polls (default 4 s / 120 ms), ≤40 actions per task ([truncation-examples §E](../references/truncation-examples.md)). The sleeps live INSIDE the async `evaluate_script` body (devtools-known-issues #2).
- **Quoting:** single quotes at code-mode level, double quotes inside the `evaluate_script` source, array-join for multi-line strings, `String.fromCharCode(10)` for newlines — zero backslashes and zero double quotes in nested strings (devtools-known-issues #3, #21).
- **Selector-quoting gotcha:** attribute-selector values with special characters (`.`, `/`, `=`, `-`) must be quoted — `a[href*="example.com"]`, NOT `a[href*=example.com]` — or `querySelectorAll` throws `not a valid selector` (devtools-known-issues #18).
- **Browser runtime only:** `evaluate_script` runs in the browser realm, not Node.js — never call `require`, `process`, `Buffer`, or other Node.js APIs inside page scripts (devtools-known-issues #23). Write plain DOM/Web-API JS and reuse the [snippet library](../references/snippets.md) (A–E, B2, D2) and the helpers installed by [X](../references/snippets.md#x-install-helpers-once-per-page-load).
- **Navigate-split:** navigate in one call (`new_page`/`navigate_page`), evaluate in the NEXT — a heavy evaluate in the same call times out (devtools-known-issues #22). Light = a small embedded-source probe reading existing DOM (D1's title/url check); heavy = snapshot-dependent or large DOM scans — always a separate call after navigation. [D2](../references/snippets.md#d2-list-click-and-relist) exercises the full navigate → list → click → re-list pattern.
- **Two-call pattern:** discover via [B](../references/snippets.md#b-filter-clickables), click via [B2](../references/snippets.md#b2-effect-verified-click) in the NEXT `evaluate_script` call with the emitted `uniqueSelector`. The DOM persists between calls, so a verified selector stays valid unless the page re-rendered.
- **WARNING semantics:** [B2](../references/snippets.md#b2-effect-verified-click)'s `WARNING: ... no state change detected` means the click did NOT register — treat as "not applied"; verify via a re-list (B) or a state/URL probe.
- **Smoke-test extractors before batches:** run an extraction script once against the FIRST entity of a batch, confirm non-empty fields, iterate until accurate — then apply to the rest. Never deploy an unvalidated extractor; a script that silently returns `{}` on entity 8 forces re-visits.
- **Fallback ladder, never identical retries:** per-entity extraction failure escalates one rung at a time — alternative selectors (Step 9) → one paced re-navigation or scroll-trigger for lazy-rendered charts ([E](../references/snippets.md#e-linkedin-hiring-trends)) → sourced cached/web data only if the task's data-source rules allow it (label the provenance) → mark the entity incomplete with a reason and continue. Each attempt must differ from the last; `Invalid or unexpected token` / `require is not defined` means rewrite the script as browser JS, not re-run it (Step 11).

**Return parsing — always through [`unwrap`](../references/snippets.md#unwrap).** `evaluate_script` returns a markdown-wrapped string (`Script ran on page and returned:` + a `json`-fenced block) whose value may be an object, array, **or a plain string** — parse the whole fenced block, never raw slicing; detect the plain-error-string prefix (`Error:` / `SyntaxError:` etc.) before parsing (devtools-known-issues #11). Never `JSON.stringify` inside the page — the harness already serializes the return value. The canonical helper lives in the [snippet library](../references/snippets.md#unwrap).

**Install the page helpers — [X](../references/snippets.md#x-install-helpers-once-per-page-load), once per page load.** The page JS realm persists across `evaluate_script` calls, so helpers installed once survive until navigation. **Re-install after every `new_page`/`navigate_page` — navigation destroys the realm.** Every snippet starts with `var H = window.__H;` and calls helpers as `H.<name>`. Helper registry: `textOf`, `visible`, `trunc`, `shortHref`, `waitHydrated`, `isCheckRadio`, `labelText`, `cssPath`, `uniqueSel`, `ctrl`, `sig`, `sigChanged`, `sleep`, `CANDIDATES`.

## Snippet index

| When | Snippet |
|------|---------|
| Open a page and probe the load | [D1](../references/snippets.md#d1-open-page-and-probe) |
| Install page helpers after any navigation | [X](../references/snippets.md#x-install-helpers-once-per-page-load) |
| Parse any `evaluate_script` return | [unwrap](../references/snippets.md#unwrap) |
| Minimal field extraction | [SELECTOR](../references/snippets.md#selector-minimal-extractor) |
| Targeted structure discovery (Step 4) | [discover](../references/snippets.md#discover-targeted-structure-discovery) |
| List clickables | [A](../references/snippets.md#a-list-clickables) |
| Filter clickables by type/text | [B](../references/snippets.md#b-filter-clickables) |
| List inputs | [C](../references/snippets.md#c-list-inputs) |
| Effect-verified click (next call) | [B2](../references/snippets.md#b2-effect-verified-click) |
| List → click → re-list in one call | [D2](../references/snippets.md#d2-list-click-and-relist) |
| Generic pagination loop (Step 6) | [paginate](../references/snippets.md#paginate-generic-pagination-loop) |
| LinkedIn hiring chart | [E](../references/snippets.md#e-linkedin-hiring-trends) |
| Sentinel drift probe (Step 9) | [probe](../references/snippets.md#probe-sentinel-drift-probe) |

## Site-specific memories

LinkedIn research knowledge lives in `mem:browser-automation/linkedin/` — chart extraction reads `company-page-growth-chart-route`, `company-growth-chart-points-extraction`, `growth-percentage-sign-ground-truth`, `employee-count-label-scope`, `unclaimed-company-page-no-chart`; job search reads `job-filter-param-click-workaround`; general (both): `search-result-title-verification`, `pattern-based-meta-field-matching`. Batch checkpoints: `mem:browser-automation/general/batch-checkpoint-template` — the [batch recipe](../recipes/batch-browser-automation.md) consumes it.
