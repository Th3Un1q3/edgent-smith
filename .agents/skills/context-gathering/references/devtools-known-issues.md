# Reference: devtools MCP — Favorite Tools & Known Issues

Verified facts from live sessions (2026-08-06). Facts only — procedures live in [workflows/browser-automation-devtools.md](../workflows/browser-automation-devtools.md). The tools below are the surface seen as of that date; re-verify the tool list on sandbox activation (the server may add tools between releases).

Full tool surface observed 2026-08-06: `click`, `close_page`, `drag`, `emulate`, `evaluate_script`, `fill`, `fill_form`, `get_console_message`, `get_network_request`, `handle_dialog`, `hover`, `lighthouse_audit`, `list_console_messages`, `list_network_requests`, `list_pages`, `navigate_page`, `new_page`, `performance_analyze_insight`, `performance_start_trace`, `performance_stop_trace`, `press_key`, `resize_page`, `select_page`, `take_heapsnapshot`, `take_screenshot`, `take_snapshot`, `type_text`, `upload_file`, `wait_for`.

## Favorite Tools

| Tool | What it does | Notes |
|---|---|---|
| `list_pages` | Enumerate open tabs | Returns a MARKDOWN table, NOT JSON (verified 2026-08-06); the lowest pageId is the primary tab — confirm by URL before acting |
| `new_page` | Open a new tab and load a URL | **Never** pass `isolatedContext` — it creates an isolated context with no session cookies, which lands on the login wall |
| `evaluate_script` | Evaluate a JS function in the currently selected page | Main workhorse; CAN await async functions; one-shot click-wait-read flows run here; returns a markdown-wrapped JSON string — strip the fence before parsing |
| `take_snapshot` | Text snapshot of the a11y tree with uids | ONLY permitted use: ONE truncated snapshot (~2 KB / text-only — worked example: [truncation-examples.md §A](./truncation-examples.md)) for structure discovery on unfamiliar sites (workflow Step 4); never for extraction; snapshot uids are ephemeral, never persist or reuse them |

## Known Issues & Nuances

1. `list_pages` returns markdown, not JSON — parse defensively or extract text (look for `## Pages` and `id: Title (URL)` rows).
2. `evaluate_script` awaits async functions even though code-mode top-level is synchronous — an `async () => { await ... }` body works inside the page.
3. Quoting: single quotes for strings in the code-mode script; double quotes inside the `evaluate_script` source; array-join for multi-line strings; avoid backslashes (`String.fromCharCode(10)` for newlines).
4. Hyphenated tool names: `globalThis["tool-name"]` (generic rule, per scripting-workflow).
5. Snapshot uids are ephemeral — do not cache or reference across calls.
6. `isolatedContext` kills session cookies → login wall.
7. Login-wall detection: URL redirects to a login page or the page renders only login prompts → STOP, escalate to the operator.
8. Structured endpoints behind CSRF/anti-bot protection with no JSON-in-DOM — DOM extraction is the reliable path (the site's extraction memory records which endpoints are protected).
9. Do not touch the operator's other tabs — never navigate or close pages we did not create.
10. Output/token discipline: snapshots and full-DOM dumps flood context; return only needed fields with a hard 3 KB cap per result (aggregate-cap enforcement: [truncation-examples.md §C](./truncation-examples.md)) — oversized results are re-run trimmed, never passed through.
11. `evaluate_script` returns a **markdown-wrapped string, not bare JSON** — the response is `Script ran on page and returned:` followed by a `json`-fenced block containing the value. The fenced value can be an object, array, **or a plain string** (e.g., a joined text excerpt), so stripping to the first `{`/last `}` fails on string returns and double-encoded values. Parse the whole fenced block with the `unwrap` helper (canonical copy: [workflows/browser-automation-devtools.md](../workflows/browser-automation-devtools.md) — Examples) and detect the plain-error prefix before parsing. Do NOT `JSON.stringify` inside the page — the harness already serializes the return value.
12. `evaluate_script` `args` must be **strings** — passing a number array yields `invalid_type: expected string, received array`. Workarounds: pass `JSON.stringify(...)` and parse inside the function, or embed the data in the function source (the skill's documented pattern).
13. `evaluate_script` can fail with `No snapshot found for page N. Use take_snapshot to capture one.` even when no snapshot was taken and none is wanted (the skill says to avoid `take_snapshot` — token sink). Workaround that worked: embed the data in the function source, do not pass args, and do NOT reach for `take_snapshot`. Root cause UNVERIFIED.
14. When `evaluate_script` errors, the sandbox returns a **plain error string, not JSON** — treating it as JSON muddies diagnosis. Check for an error prefix before attempting JSON.parse.
15. `take_snapshot` returns the FULL a11y tree — no truncation parameter exists; it can be tens of KB. The script must truncate/filter before returning (truncation helpers: [truncation-examples.md §A](./truncation-examples.md)). An untruncated snapshot is a context blowout.
16. Click by text works without snapshot uids: `Array.from(document.querySelectorAll('button,a')).find(el => el.textContent.includes('…')).click()` — verified 2026-08-06; avoids the snapshot token sink.
17. Rapid address-bar navigation (repeated `new_page`/`navigate_page`) triggers bot detection on wellfound.com (source: observed session 2026-08-06 + operator). Observed signal: UNVERIFIED — the alert fired, but the exact signal text was not recorded. On detection: STOP, cache partials to `private/`, report to the operator. `evaluate_script` in-page clicks at paced intervals (≥1 s) do not trigger it. Cross-URL navigation to distinct resources (list item → its detail page) is a separate, site-tolerated case — record the site's address-bar tolerance in the extraction memory (workflow Step 3).
18. Attribute-selector values containing special characters (`.`, `/`, `=`, `-`) must be quoted: use `a[href*="example.com"]`, NOT `a[href*=example.com]` — the unquoted form makes `querySelectorAll` throw `not a valid selector` (observed 2026-08-10).

## Return-Format Summary

| Tool | Expected return | Success signal |
|---|---|---|
| `list_pages` | MARKDOWN table (`## Pages`, `id: Title (URL)` rows) | Target URL present in a row; no error text |
| `new_page` | String confirmation (exact text not captured 2026-08-06 — re-verify on first use) | New page id appears in a subsequent `list_pages`; URL is not a login wall |
| `evaluate_script` | Markdown-wrapped JSON string (`Script ran on page and returned:` + `json` fence) | Strip the `json` fence, parse from first `{` to last `}`; fields non-empty; no error prefix |
| `take_snapshot` | a11y text snapshot with uids | ONLY permitted use: ONE truncated snapshot (~2 KB — see [truncation-examples.md §A](./truncation-examples.md)) for structure discovery on unfamiliar sites; never for extraction; click by text instead of uid-based clicks |
