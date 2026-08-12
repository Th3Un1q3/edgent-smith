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

### Give every loop a Loop Breakpoint with the same loop id

Loop Data, Loop Elements, and Repeat Task require a Loop Breakpoint block whose loop id matches the loop block. The breakpoint defines the loop scope — without it the looping "will not work" and runs once.

Three looping mechanisms: Loop Data (variables, table rows, Google Sheets, a custom JSON array), Loop Elements (page elements), and Repeat Task (a count plus a start point).

Pair every loop block with its breakpoint:

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

Wire `Loop Data (loopId: users) → Loop Breakpoint (loopId: users) → Get Text → Next Loop Item`. A breakpoint with a different loop id leaves the loop unbounded and the body unrun.

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
| Loop without a Loop Breakpoint | loop body runs once, no error | add a Loop Breakpoint with the matching loop id |
| Web-interaction block before an active tab | "Can't connect to a tab..." error | insert New Tab or Active Tab first |
| Secrets in block options | credentials sit in plaintext workflow JSON | move them to Credentials; read `{{secrets@name}}` |
