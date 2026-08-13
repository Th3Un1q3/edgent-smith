# Workflow: Create an Automa Workflow as JSON

Follow this workflow to produce a valid `.automa.json` file a user can import into the Automa extension and run.

When to load: when a user asks to build, create, or write an Automa workflow — either as JSON or guided through the editor UI.

## Prerequisites

Load these references before writing JSON.

- [workflow-json-schema.md](../references/workflow-json-schema.md) — top-level schema, node and edge format, settings, export form.
- [block-reference.md](../references/block-reference.md) — block labels, option fields, `refDataKeys`, the 61-block catalog.
- [state-and-expressions.md](../references/state-and-expressions.md) — `{{}}` namespaces, variables, table, globalData, secrets.
- [design-patterns.md](../references/design-patterns.md) — trigger table, connection rules, state decisions, robustness.

Confirm `python3` exists on the PATH; step 4 uses it to parse the output.

## Steps

### 1. Choose the entry path

Decide who builds the workflow: author JSON directly (primary) or guide the user through the editor UI. The JSON path yields a reviewable, versionable file; the UI path suits a user who wants visual construction.

**JSON path (primary).** Write the `.automa.json` file, then have the user import it: dashboard → arrow-down → "Import workflow" ([workflow-json-schema.md](../references/workflow-json-schema.md#stored-form-vs-export-form)). Author fresh files with the export-form key set; edit existing files in place, keeping their key set.

**UI path (guided).** When the user wants the visual editor, walk the docs quick-start: dashboard → New workflow → name/description → the editor opens with a trigger block → drag blocks from the left palette onto the canvas → drag the trigger block's output dot into the next block's input → save → run with the play icon, or press Ctrl/⌘+Shift+E. Keep the Automa popup open while a Popup-mode workflow runs — closing it stops the run ([design-patterns.md](../references/design-patterns.md#choose-the-execution-mode-by-runtime-versus-capability)).

### 2. Plan the workflow

Keep planning brief; the design depth lives in [design-patterns.md](../references/design-patterns.md). Answer four questions before writing JSON:

1. **Trigger** — pick the type that matches when the run starts: manual for testing, interval for a timer, on-website for URL visits, shortcut for a hotkey. Table: [design-patterns.md](../references/design-patterns.md#pick-a-trigger-that-matches-when-the-workflow-runs). One workflow carries exactly one trigger.
2. **Goal steps** — list the blocks in order. Put a `new-tab` or `active-tab` block before any web-interaction block ([design-patterns.md](../references/design-patterns.md#satisfy-the-active-tab-precondition-before-web-interaction-blocks)).
3. **Data flow** — decide where each value lives: globalData for shared constants, trigger parameters for per-run input, variables for ephemeral values, the table for row-appended results, credentials for secrets. Decision table: [design-patterns.md](../references/design-patterns.md#managing-state); access syntax: [state-and-expressions.md](../references/state-and-expressions.md#namespaces).
4. **Structure** — every loop needs a `loop-breakpoint` with a matching `loopId` ([design-patterns.md](../references/design-patterns.md#give-every-loop-a-loop-breakpoint-with-the-same-loop-id)); every conditions block needs a fallback path ([design-patterns.md](../references/design-patterns.md#conditions-route-to-a-matching-condition-output-or-the-fallback)).

The trigger choice maps directly to one JSON field:

```json
[
{ "id": "triggerNode", "label": "trigger", "data": { "type": "manual" } },
{ "id": "triggerNode", "label": "trigger", "data": { "type": "on-website", "url": "https://example.com/products/*", "isUrlRegex": false } }
]
```

### 3. Assemble the JSON

Build the file in five passes, then validate (step 4). Use the complete worked example in [Examples](#examples) as the reference shape.

1. **Skeleton** — copy the top-level schema from [workflow-json-schema.md](../references/workflow-json-schema.md#top-level-schema). Fresh files use the export-form key set ([stored form vs export form](../references/workflow-json-schema.md#stored-form-vs-export-form)): `name`, `icon`, `table`, `version`, `drawflow`, `settings`, `globalData`, `description`, `extVersion`, `includedWorkflows`. Import regenerates `id` and `createdAt`; you do not need them.
2. **Nodes** — one node per planned block. `label` names the block; `type` names the editor component (`BlockBasic`, `BlockConditions`, ...); `data` holds the options. Labels: [block-reference.md](../references/block-reference.md#full-catalog-61-blocks-grouped-by-category); per-block option fields: [block-reference.md](../references/block-reference.md#common-blocks-in-depth). Copy the full default `data` object from the registry or the reference examples; omit fields the reference marks omit-able. The `label` is the registry key, never the display name ([block-reference.md](../references/block-reference.md#how-blocks-are-identified-in-json)).
3. **Edges** — connect each output to the next input. `sourceHandle` = `${sourceId}-output-1` for the default output; `targetHandle` = `${targetId}-input-1`. Branch blocks name their outputs — condition ids for `conditions`, `fallback` for the else path ([workflow-json-schema.md](../references/workflow-json-schema.md#edges--branches), [branch outputs](../references/block-reference.md#branch-fallback-and-parallel-connections)). Every edge's source and target must be node ids in `drawflow.nodes`.
4. **Settings** — write the five runtime keys with valid enum values: `onError` ∈ `keep-running` | `restart-workflow` | `stop-workflow`; `execContext` ∈ `popup` | `background` ([workflow-json-schema.md](../references/workflow-json-schema.md#settings)).
5. **Interpolation** — write `{{...}}` tags only in fields the block's `refDataKeys` lists ([state-and-expressions.md](../references/state-and-expressions.md#the--language)). Use one of the nine namespaces and names without spaces, `@`, or `[]` ([state-and-expressions.md](../references/state-and-expressions.md#namespaces), [common mistakes](../references/state-and-expressions.md#common-mistakes)).

Node, edge, settings, and interpolation fragments:

```json
{ "id": "newTabNode", "label": "new-tab", "type": "BlockBasic", "position": { "x": 96, "y": 230 }, "data": { "url": "https://example.com", "active": true, "waitTabLoaded": false, "inGroup": false } }
```

```json
{
  "source": "triggerNode",
  "target": "newTabNode",
  "sourceHandle": "triggerNode-output-1",
  "targetHandle": "newTabNode-input-1",
  "id": "edge-1"
}
```

```json
{ "blockDelay": 0, "saveLog": true, "debugMode": false, "execContext": "popup", "onError": "stop-workflow" }
```

```json
{ "url": "{{globalData.baseUrl}}/products/{{variables.productId}}" }
```

### 4. Validate the output

Run every check below; any failure blocks delivery. Fix the failing piece, then re-run all checks.

1. **Parses as JSON.** Run `python3 -c "import json,pathlib; json.loads(pathlib.Path('OUTPUT.automa.json').read_text())"`. Exit code 0 passes; a traceback names the offending line.
2. **Labels exist in the catalog.** Every node `label` appears in the 61-block catalog ([block-reference.md](../references/block-reference.md#full-catalog-61-blocks-grouped-by-category)). An unknown label is either a typo or a business/custom block — flag it, do not ship silently ([caveats](../references/block-reference.md#caveats)).
3. **Edges resolve.** Every edge's `source` and `target` match a node id in `drawflow.nodes`. `sourceHandle` matches `${sourceId}-output-N` or a documented branch name; `targetHandle` matches `${targetId}-input-1`. Follow the handle format: [workflow-json-schema.md](../references/workflow-json-schema.md#edges--branches).
4. **Namespaces resolve.** Every `{{...}}` tag starts with one of: `variables`, `table`, `globalData`, `loopData`, `secrets`, `prevBlockData`, `workflow`, `googleSheets`, `activeTabUrl` ([state-and-expressions.md](../references/state-and-expressions.md#namespaces)). Variable names contain no spaces, `@`, or `[]`. `{{secrets@name}}` is the one legal `@` — the `secrets` separator.
5. **Settings are valid.** `onError` ∈ `keep-running` | `restart-workflow` | `stop-workflow`; `execContext` ∈ `popup` | `background`. Anything else breaks the settings contract ([workflow-json-schema.md](../references/workflow-json-schema.md#settings)).
6. **Exactly one trigger.** A workflow holds one trigger node — `maxConnection: 1` ([block-reference.md](../references/block-reference.md#common-blocks-in-depth)).
7. **Loops pair with breakpoints.** Every `loop-data`, `loop-elements`, or `repeat-task` node has a `loop-breakpoint` node with the same `loopId` ([design-patterns.md](../references/design-patterns.md#give-every-loop-a-loop-breakpoint-with-the-same-loop-id)). No loop nodes → check passes.

```json
[
{ "id": "loopNode", "label": "loop-data", "data": { "loopId": "items", "loopData": "[{\"id\": 1}]" } },
{ "id": "breakpointNode", "label": "loop-breakpoint", "data": { "loopId": "items" } }
]
```

```json
[
{ "value": "{{variables.productTitle}}" },
{ "value": "{{vars.productTitle}}" },
{ "value": "{{variables.product title}}" }
]
```

## Examples

### Complete worked example — trigger → new-tab → get-text → insert-data

```json
{
  "name": "Scrape product title",
  "icon": "riGlobalLine",
  "table": [
    {
      "id": "col_title",
      "name": "title",
      "type": "Text"
    }
  ],
  "version": "1.30.02",
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
          "findBy": "cssSelector",
          "waitForSelector": true,
          "waitSelectorTimeout": 5000,
          "selector": "h1.product-title",
          "multiple": false,
          "saveData": false,
          "dataColumn": "title",
          "assignVariable": true,
          "variableName": "productTitle"
        }
      },
      {
        "id": "insertDataNode",
        "label": "insert-data",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 570 },
        "data": {
          "dataList": [
            {
              "name": "title",
              "value": "{{variables.productTitle}}",
              "type": "table",
              "isFile": false
            }
          ],
          "tableName": ""
        }
      }
    ],
    "edges": [
      {
        "source": "triggerNode",
        "target": "newTabNode",
        "sourceHandle": "triggerNode-output-1",
        "targetHandle": "newTabNode-input-1",
        "id": "edge-trigger-newtab"
      },
      {
        "source": "newTabNode",
        "target": "getTextNode",
        "sourceHandle": "newTabNode-output-1",
        "targetHandle": "getTextNode-input-1",
        "id": "edge-newtab-gettext"
      },
      {
        "source": "getTextNode",
        "target": "insertDataNode",
        "sourceHandle": "getTextNode-output-1",
        "targetHandle": "insertDataNode-input-1",
        "id": "edge-gettext-insertdata"
      }
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
  "extVersion": "1.30.02",
  "includedWorkflows": {}
}
```

Automa ≥1.30 requires `data.dataList` (array of `{name, value, type, isFile}`; `type:'table'` writes to column `name`). The legacy `data: [...]` array crashes at runtime with `t.dataList is not iterable`.

## Clarification Triggers

Ask the user before proceeding if:

- The target browser is unknown — JS expressions (the `!!` prefix) run only on Chromium ([state-and-expressions.md](../references/state-and-expressions.md#js-expressions-chromium-only)).
- The workflow reads a page whose structure is unknown — a `get-text` or `event-click` selector needs a real selector from the target page.
- The user asks for blocks the references do not cover — labels outside the 61-block catalog may be business/custom blocks ([block-reference.md](../references/block-reference.md#caveats)).
- The user wants to edit an existing `.automa.json` — preserve its key set and edit in place instead of rewriting it in export form.

## Runtime-verification pre-flight (BEFORE handing a workflow to the user for a live test)

Run this checklist before a workflow leaves your hands for a live test. The facts below cost re-test rounds when assumed instead of checked — confirm each against the real target before handoff.

- **Block schemas** — for any block `data` you did not copy verbatim from a known-working export, check the AutomaApp/automa source on GitHub (`src/workflowEngine/blocksHandler/`, `src/workflowEngine/utils/`, `src/utils/shared.js`). Known 1.30.02 facts: `insert-data` reads `data.dataList` (array of `{name, value, type, isFile}`); the legacy `data: [...]` array crashes at runtime with `t.dataList is not iterable`. Block-level `onError` is an OBJECT — `{"enable": true, "toDo": "continue"}` — a bare string is silently ignored and falls through to the workflow-level stop.
- **JS blocks (`javascript-code`)** — `data.code` executes RAW: `{{...}}` is NOT interpolated, and the editor's variable autocomplete writes raw JS, not templates. In-scope globals: `automaRefData(keyword, path)`, `automaSetVariable(name, value)`, `automaNextBlock(data, insert)`, `automaResetTimeout()`, `automaFetch(type, resource)`. Read variables with `automaRefData('variables', '<name>')` — the engine forwards real variables only when `data.code` literally contains the string `automaRefData`. Never click links/anchors from JS that navigate — SPA navigation destroys the injected context and can hang the block; in-pane expand toggles must exclude `a` elements (guard with `el.closest('a')`).
- **Templating** — functions are `$`-prefixed only. The bare key `{{table}}` renders the WHOLE workflow table as a JSON array — use it in webhook bodies: `"items":{{table}}`. There is NO `tableData` function — unresolved keys stay literal, so `JSON.parse` fails. `!!` sandbox expressions are NOT evaluated on the new-tab `url` field; plain `{{variables.*}}` interpolation works there.
- **Selectors** — check against the LIVE page before relying on them. Classes may be hashed (A/B render); prefer stable attributes (`data-testid`, `aria-label`, `componentkey`, `role`, text markers). On list pages, scope the card selector to the results container — e.g. `//div[contains(@class, '<results-container>')]//div[...card...]` — so recommended/similar sections do not match. English-literal text selectors (`'Next'`, `'About the job'`, `'Save'`) are locale-fragile.
- **Automated gates** — run `python3 scripts/validate_workflow.py <workflow>` and `python3 scripts/check_workflow_code.py <workflow>` before handoff; both must exit 0. They encode the known traps: insert-data schema, `{{` in JS code, `tableData(`, `!!` on url.

## Acceptance Criteria

- [ ] Produced file parses: `python3 -c "import json,pathlib; json.loads(pathlib.Path('OUTPUT.automa.json').read_text())"` exits 0.
- [ ] Every node `label` appears in the block catalog ([block-reference.md](../references/block-reference.md#full-catalog-61-blocks-grouped-by-category)) or is flagged as a business/custom block.
- [ ] Every edge's `source` and `target` match a node id in `drawflow.nodes`; `sourceHandle` follows `${sourceId}-output-N` or a documented branch name; `targetHandle` follows `${targetId}-input-1`.
- [ ] Every `{{...}}` tag uses one of the nine namespaces; variable names contain no spaces, `@`, or `[]`; no tag references an unreachable namespace.
- [ ] `settings.onError` ∈ `keep-running` | `restart-workflow` | `stop-workflow`; `settings.execContext` ∈ `popup` | `background`.
- [ ] Exactly one trigger node exists.
- [ ] Every loop node pairs with a `loop-breakpoint` carrying the same `loopId`.
- [ ] The worked example in [Examples](#examples) passes all checks above and parses as JSON.
