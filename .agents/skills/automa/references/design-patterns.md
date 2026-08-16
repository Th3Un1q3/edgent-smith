# Reference: Design Best Practices for Automa Workflows

Canonical design guidance for Automa workflows: which blocks to choose, how to connect them, where state should live, and how to build for failure. The block catalog lives in [block-reference.md](./block-reference.md) and the full `{{}}` expression language in [state-and-expressions.md](./state-and-expressions.md).

When to load: when designing a workflow — picking a trigger, choosing and connecting blocks, deciding whether a value belongs in global data, parameters, variables, or the table, or reviewing a workflow for robustness before it ships.

## Vocabulary

- **block:** one automation step — trigger, action, or logic unit — in a workflow.
- **handle:** a connection point on a block; output handles feed the input handles of downstream blocks.
- **fallback output:** the default output a block takes when no other output matches — for example, a Conditions block whose conditions all fail, or a block whose on-error mode is "Execute fallback".
- **storage variable:** a `$$`-prefixed variable persisted in browser storage across workflows.

## Choosing the right blocks

### Pick a trigger that matches when the workflow runs

The trigger block starts the workflow, and its type decides when. This is the first design decision because it also decides what data enters the workflow.

| Trigger type | Runs when | Notes |
|---|---|---|
| Manually | user clicks run | default; keep for testing |
| Interval | on a timer | — |
| On a specific date | once, at a date/time | — |
| On a specific day | on a recurring weekday | — |
| On browser startup | browser opens | — |
| Cron job | cron expression | — |
| Context menu | user right-clicks a page | injects `$ctxElSelector`, `$ctxTextSelection`, `$ctxMediaUrl`, `$ctxLink`; requires the `contextMenu` permission |
| When visiting a website | URL matches | plain URL or regex when "Use regex" is checked |
| Keyboard shortcut | shortcut pressed | does not fire on `chrome://` or `chrome-extension://` URLs |
| CustomEvent | `automa:execute-workflow` event | lets external scripts and tools start the workflow with data |

```javascript
window.dispatchEvent(new CustomEvent('automa:execute-workflow', {
  detail: { id: 'WORKFLOW_ID', data: { variables: { keyword: 'automa' } } }
}));
```

Context-menu trigger — read the selection downstream as `{{$ctxTextSelection}}`.

```json
{
  "id": "n1",
  "label": "trigger",
  "type": "BlockBasic",
  "position": { "x": 96, "y": 75.5 },
  "data": {
    "disableBlock": false,
    "description": "Run from the context menu",
    "type": "contextmenu",
    "contextMenuName": "Extract selection",
    "contextTypes": []
  }
}
```

Match the trigger type to when the workflow must run; context-menu and CustomEvent triggers inject data the workflow consumes.

### Satisfy the active-tab precondition before web-interaction blocks

Click, Get Text, Forms, and every other web-interaction block operate on the active tab. Place a New Tab or Active Tab block before them.

Violating the precondition produces the documented error: `Can't connect to a tab, use 'New tab' or 'Active tab' block before using the '{name}' block`.

Valid order `Trigger → Active Tab → Get Text`; invalid order `Trigger → Get Text`.

### Rebind the active tab after close-tab

`close-tab` leaves the engine holding a stale reference to the closed tab. The next web-interaction block — `attribute-value`, `javascript-code`, `get-text`, … — fails with `Can't connect to a tab, use 'New tab' or 'Active tab' block before using the '{name}' block`. A per-block `onError: continue` masks the failure until a later block without `onError` trips the workflow-level `stop-workflow` and kills the run.

Insert an `active-tab` block immediately after every `close-tab` to rebind the engine to the currently active tab.

In Automa ≥ 1.28 the `active-tab` block's data carries no `url` or `tabType` fields — the legacy pre-1.28 shape. It rebinds; it does not navigate.

`active-tab` binds only to the currently focused tab — it has no URL/title/id targeting. When the tab you need is not the focused one (the common case right after `close-tab`), switch deterministically with `switch-tab` by Match Pattern: `findTabBy: "match-patterns"`, `matchPattern` (MDN match-pattern syntax; scheme required; query string ignored), `activeTab: true`, `createIfNoMatch: false` (data keys verified against AutomaApp/automa engine source).

```json
[
  { "id": "closeTabNode", "label": "close-tab", "data": { "disableBlock": false } },
  { "id": "rebindTabNode", "label": "active-tab", "data": { "disableBlock": false } }
]
```

### Give every loop-data/loop-elements loop a Loop Breakpoint with the same loop id (repeat-task takes none)

Loop Data and Loop Elements require a Loop Breakpoint block whose loop id matches the loop block, placed at the END of the loop body. Repeat Task does NOT use a Loop Breakpoint: it iterates via continuation edges back into the repeat-task node's input-1 and exits via output-1, so a breakpoint wired to a repeat-task loopId crashes the workflow on the first iteration with `Can't find a loop with "<loopId>" loop id` — repeat-task never populates the engine's loop list; only loop-data/loop-elements do. Verified against AutomaApp/automa engine source (handlerRepeatTask.js, handlerLoopBreakpoint.js).

Three looping mechanisms: Loop Data (variables, table rows, Google Sheets, a custom JSON array), Loop Elements (page elements), and Repeat Task (a count plus a start point).

Pair loop-data/loop-elements with a breakpoint; never pair repeat-task with one:

```json
{
  "id": "n6",
  "label": "loop-data",
  "type": "BlockRepeatTask",
  "position": { "x": 96, "y": 230 },
  "data": {
    "disableBlock": false,
    "loopId": "users",
    "loopData": "[{\"name\": \"Ada\"}, {\"name\": \"Grace\"}]",
    "loopThrough": "data-columns"
  }
}
```

```json
{
  "id": "n7",
  "label": "loop-breakpoint",
  "type": "BlockLoopBreakpoint",
  "position": { "x": 96, "y": 400 },
  "data": {
    "disableBlock": false,
    "loopId": "users"
  }
}
```

Wire `Loop Data (loopId: users) → Loop Breakpoint (loopId: users) → Get Text → Next Loop Item` — the breakpoint sits at the END of the loop body and returns control to the loop for the next item. A breakpoint whose `loopId` matches no loop block — including a repeat-task loopId — throws `Can't find a loop with "<loopId>" loop id` on the first iteration.

### Serialize HTTP requests as webhook with http/https URLs

The HTTP Request block serializes in workflow JSON under the key `webhook`, and its URL must start with `http` or `https`.

```json
{
  "id": "n3",
  "label": "webhook",
  "type": "BlockBasicWithFallback",
  "position": { "x": 96, "y": 230 },
  "data": {
    "disableBlock": false,
    "url": "https://api.example.com/items",
    "method": "GET",
    "timeout": 10000,
    "responseType": "json"
  }
}
```

Keep the scheme; `ftp://` or a bare host fails validation.

## Connecting blocks

Four documented ways to connect a block output to an input: drag output → input, drop a block into a block output, click an output then an input, or drop a block onto another block.

### Conditions route to a matching condition output or the fallback

A Conditions block checks every condition it holds. A match continues to the block on that condition's output; no match continues to the block on the fallback output. The on-error "Execute fallback" setting reuses the same fallback output.

Wire both paths — success to the condition output, failure to the fallback:

```json
{
  "id": "n5",
  "label": "conditions",
  "type": "BlockConditions",
  "position": { "x": 96, "y": 230 },
  "data": {
    "disableBlock": false,
    "conditions": [
      {
        "id": "count-gt-0",
        "expression": {
          "valueType": "number::",
          "value": "{{variables.count}}",
          "compareType": "gt",
          "data": "0"
        }
      }
    ]
  }
}
```

Wire `Conditions (Has results?) → [condition output] → Extract results; [fallback output] → Send notification`. Skipping the fallback connection dead-ends failures.

### Each extra output connection spawns a parallel worker

A block's output handles run downstream in parallel: each additional connection from the same output creates its own worker.

A single trigger connected to both `Get Text` and `Screenshot` runs both at once; connect sequentially only when order matters.

### Fan out freely; merge branches deliberately

Branching costs nothing, but every branch must rejoin or terminate. Merge fan-in at a single common next block — a Blocks Group or the next Conditions block — instead of letting branches dangle.

`Condition → branch A → Send Message`, `Condition → branch B → Send Message`: both branches end at the same block, so no path falls off the graph.

### Style lines to document intent

The Lines tab of a block's settings sets a line label, animation, and color. Use the label to record what a path means — "retry path", "user found" — so the graph reads without a legend.

### Configure per-block on-error before shipping

Per-block on-error offers Enable, Retry action, Throw error, Continue flow, Execute fallback, and Insert data into table/variable. Pick one per block by what a failure should do.

An HTTP request that can fail transiently gets `Retry action` with an interval; a block whose failure is non-fatal gets `Continue flow`.

Block-level `onError` in workflow JSON is an OBJECT, never a string: `{"enable": true, "toDo": "retry", "retryTimes": 2, "retryInterval": 1000}` or `{"enable": true, "toDo": "continue"}`. A bare string is silently ignored and falls through to the workflow-level `settings.onError` policy. Per-block onError is available on new-tab, javascript-code, close-tab, active-tab, switch-tab, event-click, link, and attribute-value; the excluded blocks are listed in [block-reference.md §Branch, fallback, and parallel connections](./block-reference.md#branch-fallback-and-parallel-connections). Verified against AutomaApp/automa engine source (src/utils/shared.js).

## Managing state

Decide where each value lives by how long it must survive and who shares it. The full expression language is in [state-and-expressions.md](./state-and-expressions.md).

| I need to... | Use... | Access pattern | Because |
|---|---|---|---|
| Share a value across many blocks or workflows (a base URL) | Global Data | `{{globalData.baseUrl}}` | define once, edit in one place |
| Vary input per run without editing blocks | Parameters, on the trigger block | `{{variables.keyword}}` | values come from the run, not the JSON |
| Hold temporary, untyped values mid-run | Variables | `{{variables.varName}}`; `$$persist`; `$push:item` | assignment overwrites; `$$` survives across workflows |
| Store typed, structured, row-appended results | Table | extraction blocks; Export Data block | blocks append rows; export Text/CSV/JSON |
| Store a credential | Credentials | `{{secrets@name}}` | encrypted, add-only, never in workflow JSON |
| Carry state across executions | "Reuse the last workflow state" workflow setting | workflow settings | keeps table, variables, and global data |

### Prefer Global Data for values shared across many blocks

Define a domain URL once in global data instead of editing every New Tab block when it changes.

Store `baseUrl` once, then every New Tab reads `{{globalData.baseUrl}}/login`. Changing the domain touches one value, not ten blocks.

### Prefer Parameters for values that change per run

Parameters are defined on the trigger block and injected into the run as `{{variables.keyword}}`. The documented rationale: "don't edit blocks between runs" — run-specific values belong in the trigger, not in block options.

A search workflow declares parameter `keyword`; the trigger receives it at run time, and the URL block interpolates `{{variables.keyword}}`.

### Use Variables for ephemeral, untyped values

Variable assignment overwrites the previous value. The `$$` prefix persists the variable across workflows; the `$push:` prefix appends a value to an array variable.

`Set variable` with `$push:item` builds a list across loop iterations; a `$$sessionUser` variable survives into the next workflow run.

### Use the Table for structured, row-appended data

Extraction blocks insert rows; the Export Data block exports Text, CSV, or JSON. Reserve the table for data that is tabular — it is typed and row-oriented, unlike variables.

A scraping loop appends one `Get Text` result row per iteration, then `Export Data` emits `data.csv`.

### Store credentials in Credentials, never in block options

Credentials are encrypted and add-only; blocks read them via `{{secrets@name}}`. Hardcoding a secret into a block option writes it into workflow JSON in plaintext.

An HTTP Request with basic auth reads `{{secrets@apiKey}}` instead of a literal key.

### Reuse the last workflow state to carry data across executions

The "Reuse the last workflow state" workflow setting carries the table, variables, and global data from one execution into the next. Turn it on only when a run genuinely needs the previous run's state.

A daily aggregation workflow reads the table row the previous run appended, instead of restarting from empty.

## Extracting data reliably

### Prefer embedded structured data (JSON-LD) over DOM traversal

Job boards and many content pages embed `<script type="application/ld+json">` — a `@type: "JobPosting"` object with a full HTML `description` field. Parse it before walking the rendered DOM: JSON-LD stays stable while section headings move. Use the extraction order: JSON-LD → stable `data-testid` fallback → text-anchored section walk → meta description last resort.

Client-rendered pages show a hydration flash — the DOM is empty before scripts mount. Poll briefly for the JSON-LD script or the fallback element; bound the poll (~5 × 700 ms) inside the 20000 ms `javascript-code` timeout.

```json
{ "label": "javascript-code", "data": { "context": "website", "timeout": 20000, "code": "const findLd = () => document.querySelector('script[type=\"application/ld+json\"]'); for (let i = 0; i < 5 && !findLd(); i++) await new Promise(r => setTimeout(r, 700)); const el = findLd(); if (!el) return { description: '' }; return { description: JSON.parse(el.textContent).description };" } }
```

### Normalize card/list hrefs before matching and shipping

List-item anchors in SPAs may sit RELATIVE in the raw DOM — `getAttribute('href')` returns `/jobs/foo-123` — while the `href` property reads absolute, and both often carry tracking queries (`?ijt=jb_55`). Regexes anchored on `-(\d+)$` miss them.

Normalize before matching: strip the query and hash (`href.split('#')[0].split('?')[0]`), then resolve relative hrefs against the page (`new URL(href, location.href)`). Ship CLEAN apply/link URLs to consumers — no tracking parameters. Gate with `element-exists` XPath that uses `contains(@href, '/jobs/')`-style matching, never `starts-with(@href, 'https://…')` — starts-with breaks on relative hrefs.

```json
{ "label": "javascript-code", "data": { "context": "website", "code": "const clean = (href) => new URL(href.split('#')[0].split('?')[0], location.href).href; return { url: clean(document.querySelector('a[data-testid=\"job-link\"]').href) };" } }
```

### Prefer SPA in-page detail panels over tab-per-job

For SPA job listings, extract from the in-page detail panel instead of opening a tab per job: tab-per-job races on `close-tab`/`active-tab` (stale engine reference after close) and multiplies navigation. One tab, one SPA route change, extract, then back. Verified against the live de.indeed.com DOM.

### Guard against honeypot listings on SPA job boards

Fake job cards exist to trap scrapers. Three defenses (verified against the live de.indeed.com DOM):

- **Capture-phase click navigation guard** — `preventDefault` same-host links whose pathname is NOT the search page, then navigate via the SPA's own state; carve out pagination links. NEVER `stopPropagation` — it kills the SPA's React handler and the click goes nowhere.
- **Card validity filter** — accept a card only when it carries a tracking href AND a valid job id; the href is the primary discriminator — a fake 16-hex id passes a naive regex, a tracking href does not.
- **Wrong-page sanity checks** — verify the search page (expected pathname/URL pattern) in BOTH the finder and the extractor before acting; a redirected or error page aborts, never extracts.

### Verify selectors against the live page, not rendered markdown

Third-party JS-rendering extractors (tavily et al.) return normalized markdown that lies about the DOM: headings may be styled `div`s, "Show more" buttons may be absent, and class names may be build-hashed (styled-components `*-sc-*`). Before finalizing selectors, verify them against the real page in a live browser (devtools MCP), keying off stable attributes — `data-testid`, `aria-label`, href patterns, visible text — never hashed classes. When a live browser is unavailable, say so; do not ship guessed selectors as fact.

```json
{ "label": "get-text", "data": { "findBy": "cssSelector", "selector": "div[data-testid='job-title']", "waitForSelector": true, "waitSelectorTimeout": 5000, "assignVariable": true, "variableName": "jobTitle" } }
```

### Prefer verified URL filter parameters over UI clicks

When a results page supports URL-encoded filters (e.g. `sincePeriod=LAST_WEEK`), navigate directly to the filtered URL instead of clicking filter controls — the controls may be locale-fragile and regenerate tokens per session. Keep the UI click as a CONDITIONAL fallback: check the URL param or the control's selected state first; click only when the filter is not already applied.

```json
{ "id": "filteredList", "label": "new-tab", "data": { "url": "https://example.com/jobs?sincePeriod=LAST_WEEK", "active": true, "waitTabLoaded": false, "inGroup": false } }
```

## Robustness

### Wait for dynamic elements before interacting

For elements that load after the page, use an Element Exists block or enable "Wait for selector" in the element-selector options of the interacting block. This is the documented first fix for common errors.

```json
{
  "id": "n4",
  "label": "event-click",
  "type": "BlockBasic",
  "position": { "x": 96, "y": 230 },
  "data": {
    "disableBlock": false,
    "findBy": "cssSelector",
    "selector": "#submit-btn",
    "waitForSelector": true,
    "waitSelectorTimeout": 5000
  }
}
```

Wire `Trigger → Element Exists (#spinner, true) → Click #submit-btn` — wait for the spinner to disappear before clicking.

### Name variables without spaces, @, or []

Variable names that contain spaces, `@`, or `[]` break `{{...}}` access. Keep names to letters, digits, and underscores.

`{{firstName}}` resolves; `{{first name}}` does not.

### Choose the execution mode by runtime versus capability

The execution mode trades runtime for capabilities.

- Popup mode: no runtime limit, but the popup must stay open.
- Background mode: about a 5-minute maximum, no popup needed.
- JS expressions and Clipboard work only in Popup mode.

A short, unattended job runs in Background mode; a long scrape or one needing the Clipboard runs in Popup mode.

### JS expressions are Chromium-only

JS expressions (the `!!` prefix) run only in Chromium-based browsers. Do not rely on them in a workflow meant for Firefox.

Prefer built-in expression functions from [state-and-expressions.md](./state-and-expressions.md) when the workflow must be cross-browser.

### Follow the error-handling ladder

Handle failure at the level where it occurs.

1. Per-block on-error: retry with interval, continue, throw, or execute fallback — for local failures.
2. Workflow-level on-error: `keep-running`, `restart-workflow` (with a max-restart count), or `stop` — for whole-run failure policy.

A flaky API call gets per-block retry; a workflow whose data source is down at start gets `restart-workflow` with `maxRestarts: 3`.

### Reach for debug and testing mode for WYSIWYG and coordinate cases

Debug mode (CDP) runs the workflow with a browser attached, for WYSIWYG editors and XY-coordinate clicks where JS emulation fails. Testing mode runs with breakpoints so you can inspect workflow state mid-run.

When a click lands on the wrong pixel, run testing mode, pause at the Click block, and switch to debug mode to see the real element coordinates.

## Common design anti-patterns

| Anti-pattern | Symptom | Fix |
|---|---|---|
| Dangling branches | part of the graph never runs after a condition | merge branches into one Blocks Group or next condition |
| Hardcoded URLs | domain change means editing every New Tab block | put the domain in global data; interpolate `{{globalData.baseUrl}}` |
| Conditions without a fallback connection | unmatched input dead-ends silently | wire the fallback output to a handler |
| Loop without a Loop Breakpoint | `loop-data`/`loop-elements` body runs once, no error | add a Loop Breakpoint with the matching loop id at the end of the body |
| `repeat-task` paired with a Loop Breakpoint | workflow crashes on the first iteration: `Can't find a loop with "<loopId>" loop id` | remove the breakpoint — repeat-task iterates via continuation edges back into input-1 |
| Web-interaction block before an active tab | "Can't connect to a tab..." error | insert New Tab or Active Tab first |
| Secrets in block options | credentials sit in plaintext workflow JSON | move them to Credentials; read `{{secrets@name}}` |
| `close-tab` without a following `active-tab` | next web-interaction errors "Can't connect to a tab..." after the tab closed | insert an `active-tab` block right after `close-tab` to rebind |
| DOM traversal for structured data | section-walk breaks when headings move | parse embedded JSON-LD first |
| Regex on raw list hrefs | relative hrefs and tracking queries defeat `-(\d+)$` | strip query/hash, resolve relative → absolute before matching |
| Selectors taken from rendered markdown | hashed classes and phantom "Show more" buttons break extraction | confirm them against the live page; key off stable attributes |
| Clicking filter controls | locale-fragile labels and regenerated tokens | navigate to the URL-encoded filter; click only as a conditional fallback |
