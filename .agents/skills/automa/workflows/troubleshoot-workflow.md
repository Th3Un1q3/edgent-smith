# Workflow: Troubleshoot a Failing Automa Workflow

Follow this workflow to diagnose a failing Automa workflow, find the root cause, and verify the fix. It covers every failure class: documented block errors, runtime engine failures, JSON structure defects, and execution-context mistakes.

When to load: a user reports a workflow "is not working", a run errors out, or a workflow misbehaves — wrong result, silent stop, or no error at all. Read this file before editing any block.

## Prerequisites

Load these references before diagnosing.

- [workflow-json-schema.md](../references/workflow-json-schema.md) — top-level schema, node and edge format, settings, per-block `onError` vocabulary.
- [block-reference.md](../references/block-reference.md) — block labels, key `data` fields, `waitSelectorTimeout` and `timeout` defaults, the 61-block catalog.
- [state-and-expressions.md](../references/state-and-expressions.md) — `{{}}` namespaces, JS expressions, the common mistakes that produce wrong values.
- [design-patterns.md](../references/design-patterns.md) — active-tab precondition, loop breakpoints, execution modes, debug and testing tooling.

Confirm you can reproduce the run: the target site must be reachable, and the Automa extension must hold the workflow imported.

## Steps

### Step 1 — Reproduce and capture evidence

Run the failing workflow exactly as the user runs it. Capture three facts from the logs: the exact error text, the failing block, and the timestamp.

Enable "Save workflow log" in the workflow settings — `settings.saveLog`, default `true` ([workflow-json-schema.md §settings](../references/workflow-json-schema.md#settings)). Logs appear in the dashboard under the workflow's Logs tab; the `log-data` block ("Get Log Data") reads the latest log inside a workflow ([block-reference.md §Full catalog](../references/block-reference.md#full-catalog-61-blocks-grouped-by-category)). Keep the popup open while you reproduce — a Popup-mode run that closes the popup ends silently ([design-patterns.md §Choose the execution mode](../references/design-patterns.md#choose-the-execution-mode-by-runtime-versus-capability)).

Record one line per failure: the exact error text, the block, and the timestamp.

```text
12:03:41  ERROR  getTextNode (get-text)  Can't connect to a tab, use 'New tab' or 'Active tab' block before using the 'Get Text' block
```

### Step 2 — Classify the error

Match the error text against the documented errors table, then against the runtime failure modes table. A text match names the cause class and points at the fix. No text match — the failure is silent; move to the runtime failure modes and the context checks in step 4.

#### Documented errors (docs/reference/workflow-common-errors.md)

| Error text | Cause | Fix |
|---|---|---|
| `Can't find an element with '{selector}' selector` | The selector matches nothing on the page | Add an `element-exists` block or enable "Wait for selector" — `waitForSelector`, `waitSelectorTimeout` default 5000 ms ([block-reference.md §Common blocks in depth](../references/block-reference.md#common-blocks-in-depth)) |
| `Can't find a tab with '{pattern}' patterns` | No open tab matches the Match Patterns | Correct the pattern; follow the MDN match-patterns syntax (`https://example.com/*`, not `example.com`) |
| `Content body is not valid JSON` | The HTTP Request (`webhook`) block's body is not valid JSON | Make the body valid JSON; keep `contentType` `json` |
| `Can't connect to a tab, use 'New tab' or 'Active tab' block before using the '{name}' block` | A web-interaction block runs with no active tab | Insert a `new-tab` or `active-tab` block on the path before it ([design-patterns.md §Satisfy the active-tab precondition](../references/design-patterns.md#satisfy-the-active-tab-precondition-before-web-interaction-blocks)) |
| `'{url}' is invalid URL` | The URL does not start with `http` or `https` | Add the scheme: `https://` before the host |

Fragments implementing each fix. Wait for the selector before extracting.

```json
{ "label": "get-text", "data": { "selector": ".product-title", "waitForSelector": true, "waitSelectorTimeout": 5000 } }
```

`https://example.com/*` matches open example.com tabs; a bare `example.com` matches none.

```json
{ "label": "trigger", "data": { "type": "on-website", "url": "https://example.com/*", "isUrlRegex": false } }
```

The body is a JSON object literal; `name=test` fails validation.

```json
{ "label": "webhook", "data": { "method": "POST", "url": "https://api.example.com/items", "contentType": "json", "body": "{\"name\": \"test\"}" } }
```

Place `new-tab` (or `active-tab`) on the path before the failing web-interaction block.

```json
{ "id": "newTabNode", "label": "new-tab", "data": { "url": "https://example.com" } }
```

Every URL carries the scheme; `api.example.com/items` alone is invalid.

```json
{ "label": "webhook", "data": { "url": "https://api.example.com/items" } }
```

#### Runtime failure modes

| Symptom | Root cause | Fix |
|---|---|---|
| Workflow stops at a block; no handler runs | The `label` is not in the block registry | Check the label against the catalog ([block-reference.md §How blocks are identified in JSON](../references/block-reference.md#how-blocks-are-identified-in-json)); a business/custom label needs its extension ([§Caveats](../references/block-reference.md#caveats)) |
| Workflow fails to start | No trigger node | The engine starts at the trigger's node ([workflow-json-schema.md §Execution semantics](../references/workflow-json-schema.md#execution-semantics)); add exactly one trigger |
| Worker destroyed mid-run | An edge or `nextBlockId` names a node that does not exist | Verify every edge resolves ([workflow-json-schema.md §Edges & branches](../references/workflow-json-schema.md#edges--branches)) |
| Block "succeeds" but results are incomplete | `javascript-code` hit its timeout — default 20000 ms ([block-reference.md §Common blocks in depth](../references/block-reference.md#common-blocks-in-depth)) | Raise `timeout` or shorten the code |
| `Could not establish connection` / `Message channel closed` | No active tab, or the content script did not inject | Put `new-tab`/`active-tab` first; reload the tab |
| `ai-workflow` block fails | Missing or invalid AI token | Provide a valid token — settings seed `aipowerToken` ([workflow-json-schema.md §settings](../references/workflow-json-schema.md#settings)) |
| `Refused to execute inline script because it violates the following Content Security Policy directive: ...` | JS runs in the `active-tab` context; the page CSP blocks it | Switch `javascript-code` to the `background` context, or probe the page with an inline-script check first |
| Expressions evaluate wrong, or fail, on Firefox | The `!!` prefix and raw JS in tags are Chromium-only | Replace them with built-in `$` functions ([state-and-expressions.md §JS expressions (Chromium only)](../references/state-and-expressions.md#js-expressions-chromium-only)) |
| Run stops early or silently | Popup mode needs the popup open; Background mode caps near 5 minutes | Match the mode to the job ([design-patterns.md §Choose the execution mode](../references/design-patterns.md#choose-the-execution-mode-by-runtime-versus-capability)) |

Fragments implementing two rows. This block resolves only after `timeout` (20000 ms) elapses, and the run continues with incomplete results.

```json
{ "label": "javascript-code", "data": { "context": "website", "timeout": 20000, "code": "await new Promise(r => setTimeout(r, 60000));" } }
```

The `background` context bypasses the page CSP; keep `active-tab` context only for scripts the page allows.

```json
{ "label": "javascript-code", "data": { "context": "background", "timeout": 20000, "code": "return { ok: true };" } }
```

#### Runtime failure checklist

When the root cause is a schema, expression, or selector assumption rather than a missing block or wrong mode, check the pre-flight list in [create-workflow.md](./create-workflow.md) before re-testing. The three most common runtime failures from those assumptions:

- `t.dataList is not iterable` — `insert-data` got the legacy `data: [...]` array; it reads `data.dataList`.
- Stored variables hold literal `{{...}}` — `javascript-code` runs `data.code` raw, so interpolation never runs; write `automaRefData('variables', '<name>')` instead of `{{variables.<name>}}` inside JS.
- `'{url}' is invalid URL` — the url field carries a `!!` expression, which the new-tab field does not evaluate; use plain `{{variables.*}}` interpolation there.

### Step 3 — Check the JSON structure (when editing JSON)

Run the validation checklist in [create-workflow.md §4. Validate the output](../workflows/create-workflow.md#4-validate-the-output) before touching any block: the JSON parses; every `label` sits in the catalog; every edge resolves; every `{{}}` namespace is valid; the settings enums hold; exactly one trigger exists; loops pair with breakpoints. The checklist names each failing piece and its fix — apply it here instead of re-reading the schema.

A structural defect looks like a dangling edge.

```json
{ "source": "ghostNode", "target": "getTextNode", "sourceHandle": "ghostNode-output-1", "targetHandle": "getTextNode-input-1", "id": "edge-dangling" }
```

### Step 4 — Check the execution context

When structure passes but the run still fails, inspect the runtime conditions around the failing block:

- **Active tab** — does a `new-tab` or `active-tab` block sit on the path before every web-interaction block? ([design-patterns.md §Satisfy the active-tab precondition](../references/design-patterns.md#satisfy-the-active-tab-precondition-before-web-interaction-blocks))
- **Execution mode** — Popup mode needs the popup open; Background mode caps near 5 minutes. Does the job fit the mode? ([design-patterns.md §Choose the execution mode](../references/design-patterns.md#choose-the-execution-mode-by-runtime-versus-capability))
- **Selector timing** — does the element exist when the block runs? Add an `element-exists` check or enable "Wait for selector". ([design-patterns.md §Wait for dynamic elements](../references/design-patterns.md#wait-for-dynamic-elements-before-interacting))
- **Loop breakpoint** — does every `loop-data`/`loop-elements` node pair with a `loop-breakpoint` carrying the same `loopId`? A missing breakpoint runs the body once. ([design-patterns.md §Give every loop a Loop Breakpoint](../references/design-patterns.md#give-every-loop-a-loop-breakpoint-with-the-same-loop-id))
- **Condition fallback** — does every `conditions` block wire its `fallback` output? An unwired fallback dead-ends unmatched input. ([design-patterns.md §Conditions route to a matching condition output](../references/design-patterns.md#conditions-route-to-a-matching-condition-output-or-the-fallback))

A loop without its breakpoint passes step 3, then misbehaves.

```json
{ "id": "loopNode", "label": "loop-data", "data": { "loopId": "items", "loopData": "[1, 2, 3]" } }
```

### Step 5 — Use the debug tooling

When classification and checks leave no confirmed cause, observe the run directly:

- **Testing mode** — runs with breakpoints; pause at any block and inspect the variables and table at that instant.
- **Debug mode (CDP, Chromium)** — attaches a browser; use it when JS-emulated clicks or typing fail, e.g. WYSIWYG editors and XY-coordinate clicks ([design-patterns.md §Reach for debug and testing mode](../references/design-patterns.md#reach-for-debug-and-testing-mode-for-wysiwyg-and-coordinate-cases)).
- **`blockDelay`** — set a delay between blocks (`settings.blockDelay`, default `0` — [workflow-json-schema.md §settings](../references/workflow-json-schema.md#settings)) to watch a slow run.
- **Per-block on-error** — set `retry` with `retryTimes`/`retryInterval` to absorb transient failures and let the log repeat the error ([workflow-json-schema.md §Execution semantics](../references/workflow-json-schema.md#execution-semantics), [design-patterns.md §Follow the error-handling ladder](../references/design-patterns.md#follow-the-error-handling-ladder)).

A transient failure retries three times at 1 s intervals instead of stopping the run.

```json
{ "data": { "onError": "retry", "retryTimes": 3, "retryInterval": 1000 } }
```

### Step 6 — Apply the fix and re-run

Change one cause per run. Re-run the workflow; confirm from the logs that the previously failing block now logs success and that downstream blocks produce the expected data. Re-check the whole path — a fix that unblocks one block can expose the next latent failure; iterate steps 2–6 until the run completes end to end.

## Examples

### Worked example — get-text before any tab (documented error 4)

The failing workflow "Grab product title" reads the product title from the active page and inserts it into the table. The JSON passes every structural check: labels exist, edges resolve, namespaces are valid, settings hold, one trigger. It fails at run time.

```json
{
  "name": "Grab product title",
  "icon": "riGlobalLine",
  "table": [
    { "id": "col_title", "name": "title", "type": "Text" }
  ],
  "version": "1.29.12",
  "drawflow": {
    "nodes": [
      {
        "id": "triggerNode",
        "label": "trigger",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 75.5 },
        "data": {
          "disableBlock": false,
          "description": "",
          "type": "manual",
          "interval": 60,
          "delay": 5,
          "date": "",
          "time": "00:00",
          "url": "",
          "shortcut": "",
          "activeInInput": false,
          "isUrlRegex": false,
          "days": [],
          "contextMenuName": "",
          "contextTypes": [],
          "parameters": [],
          "preferParamsInTab": false,
          "observeElement": {
            "selector": "",
            "baseSelector": "",
            "matchPattern": "",
            "targetOptions": {
              "subtree": false,
              "childList": true,
              "attributes": false,
              "attributeFilter": [],
              "characterData": false
            },
            "baseElOptions": {
              "subtree": false,
              "childList": true,
              "attributes": false,
              "attributeFilter": [],
              "characterData": false
            }
          }
        }
      },
      {
        "id": "getTextNode",
        "label": "get-text",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 230 },
        "data": {
          "disableBlock": false,
          "findBy": "cssSelector",
          "waitForSelector": true,
          "waitSelectorTimeout": 5000,
          "selector": "h1.product-title",
          "markEl": false,
          "multiple": false,
          "regex": "",
          "prefixText": "",
          "suffixText": "",
          "regexExp": [],
          "dataColumn": "title",
          "saveData": true,
          "includeTags": false,
          "addExtraRow": false,
          "assignVariable": true,
          "useTextContent": false,
          "variableName": "productTitle",
          "extraRowValue": "",
          "extraRowDataColumn": ""
        }
      },
      {
        "id": "insertDataNode",
        "label": "insert-data",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 400 },
        "data": {
          "data": [
            { "dataColumn": "title", "value": "{{variables.productTitle}}" }
          ],
          "tableName": ""
        }
      }
    ],
    "edges": [
      { "source": "triggerNode", "target": "getTextNode", "sourceHandle": "triggerNode-output-1", "targetHandle": "getTextNode-input-1", "id": "edge-trigger-gettext" },
      { "source": "getTextNode", "target": "insertDataNode", "sourceHandle": "getTextNode-output-1", "targetHandle": "insertDataNode-input-1", "id": "edge-gettext-insertdata" }
    ],
    "zoom": 1.3
  },
  "settings": {
    "blockDelay": 0,
    "saveLog": true,
    "debugMode": false,
    "execContext": "popup",
    "onError": "stop-workflow"
  },
  "globalData": "{}",
  "description": "Read the product title from the current page and append it as a table row.",
  "extVersion": "1.29.12",
  "includedWorkflows": {}
}
```

**Reproduce.** Run the workflow. The dashboard log records one failure:

```text
12:03:41  ERROR  getTextNode (get-text)  Can't connect to a tab, use 'New tab' or 'Active tab' block before using the 'Get Text' block
```

**Classify.** The text matches the documented error 4 row: a web-interaction block with no active tab.

**Root cause.** `triggerNode` connects straight into `getTextNode`. No `new-tab` or `active-tab` block sits on the path, so the engine hands `get-text` no tab to operate on. The structure checks pass — this is a context defect, found by step 4, not step 3.

**Fix.** Insert a `new-tab` node between `triggerNode` and `getTextNode`; rewire two edges — `triggerNode-output-1 → newTabNode-input-1` and `newTabNode-output-1 → getTextNode-input-1`. The `getTextNode → insertDataNode` edge stays. The fixed file:

```json
{
  "name": "Grab product title",
  "icon": "riGlobalLine",
  "table": [
    { "id": "col_title", "name": "title", "type": "Text" }
  ],
  "version": "1.29.12",
  "drawflow": {
    "nodes": [
      {
        "id": "triggerNode",
        "label": "trigger",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 75.5 },
        "data": {
          "disableBlock": false,
          "description": "",
          "type": "manual",
          "interval": 60,
          "delay": 5,
          "date": "",
          "time": "00:00",
          "url": "",
          "shortcut": "",
          "activeInInput": false,
          "isUrlRegex": false,
          "days": [],
          "contextMenuName": "",
          "contextTypes": [],
          "parameters": [],
          "preferParamsInTab": false,
          "observeElement": {
            "selector": "",
            "baseSelector": "",
            "matchPattern": "",
            "targetOptions": {
              "subtree": false,
              "childList": true,
              "attributes": false,
              "attributeFilter": [],
              "characterData": false
            },
            "baseElOptions": {
              "subtree": false,
              "childList": true,
              "attributes": false,
              "attributeFilter": [],
              "characterData": false
            }
          }
        }
      },
      {
        "id": "newTabNode",
        "label": "new-tab",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 230 },
        "data": {
          "disableBlock": false,
          "description": "",
          "url": "https://example.com/products/42",
          "userAgent": "",
          "active": true,
          "tabZoom": 1,
          "inGroup": false,
          "waitTabLoaded": false,
          "updatePrevTab": false,
          "customUserAgent": false
        }
      },
      {
        "id": "getTextNode",
        "label": "get-text",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 400 },
        "data": {
          "disableBlock": false,
          "findBy": "cssSelector",
          "waitForSelector": true,
          "waitSelectorTimeout": 5000,
          "selector": "h1.product-title",
          "markEl": false,
          "multiple": false,
          "regex": "",
          "prefixText": "",
          "suffixText": "",
          "regexExp": [],
          "dataColumn": "title",
          "saveData": true,
          "includeTags": false,
          "addExtraRow": false,
          "assignVariable": true,
          "useTextContent": false,
          "variableName": "productTitle",
          "extraRowValue": "",
          "extraRowDataColumn": ""
        }
      },
      {
        "id": "insertDataNode",
        "label": "insert-data",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 570 },
        "data": {
          "data": [
            { "dataColumn": "title", "value": "{{variables.productTitle}}" }
          ],
          "tableName": ""
        }
      }
    ],
    "edges": [
      { "source": "triggerNode", "target": "newTabNode", "sourceHandle": "triggerNode-output-1", "targetHandle": "newTabNode-input-1", "id": "edge-trigger-newtab" },
      { "source": "newTabNode", "target": "getTextNode", "sourceHandle": "newTabNode-output-1", "targetHandle": "getTextNode-input-1", "id": "edge-newtab-gettext" },
      { "source": "getTextNode", "target": "insertDataNode", "sourceHandle": "getTextNode-output-1", "targetHandle": "insertDataNode-input-1", "id": "edge-gettext-insertdata" }
    ],
    "zoom": 1.3
  },
  "settings": {
    "blockDelay": 0,
    "saveLog": true,
    "debugMode": false,
    "execContext": "popup",
    "onError": "stop-workflow"
  },
  "globalData": "{}",
  "description": "Open a product page, extract the h1 title into a variable, and append it as a table row.",
  "extVersion": "1.29.12",
  "includedWorkflows": {}
}
```

**Re-verify.** Re-run; the log shows `newTabNode` opening the tab, `getTextNode` logging success, and the table gaining the expected row.

## Clarification Triggers

Ask the user before proceeding if:

- The failing block's label never resolves in the catalog — it may be a business/custom block ([block-reference.md §Caveats](../references/block-reference.md#caveats)).
- The workflow runs on Firefox and uses JS expressions — the `!!` prefix is Chromium-only ([state-and-expressions.md §JS expressions (Chromium only)](../references/state-and-expressions.md#js-expressions-chromium-only)).
- The workflow contains `ai-workflow` blocks — Automa AI generates them; treat them as opaque ([block-reference.md §Caveats](../references/block-reference.md#caveats)).
- Logs are disabled and the failure no longer reproduces — without evidence, classification is guesswork; re-enable `saveLog` and reproduce first.

## Acceptance Criteria

- [ ] The error text matched exactly one row of the documented-errors table or the runtime failure modes table; the report quotes the text verbatim with the failing block and timestamp.
- [ ] The root cause names the failing block and the violated precondition; the fix changes one cause per run.
- [ ] Re-run evidence confirms the previously failing block logs success and downstream blocks produce the expected data.
- [ ] When the structural checks pass but the failure persists, the report names the debug tooling used (testing mode, debug mode, `blockDelay`, or per-block retry) and what it showed.
- [ ] Any JSON edit passes the validation checklist in [create-workflow.md §4. Validate the output](../workflows/create-workflow.md#4-validate-the-output); the worked-example JSON parses — `python3 -c "import json,pathlib; json.loads(pathlib.Path('FILE.automa.json').read_text())"` exits 0.
