# Workflow: Understand an Existing Automa Workflow

Follow this workflow to turn any `.automa.json` file — or a pasted workflow JSON — into an accurate plain-language explanation of what the workflow does. This workflow reads only; it never edits the file.

When to load: a user shares an `.automa.json` file, pastes workflow JSON, or asks "what does this automa workflow do?".

## Prerequisites

- [workflow-json-schema.md](../references/workflow-json-schema.md) — the envelope, node, and edge format; the stored vs export form.
- [block-reference.md](../references/block-reference.md) — the block catalog: labels, categories, key data fields.
- [state-and-expressions.md](../references/state-and-expressions.md) — the `{{}}` language, namespaces, functions.
- [design-patterns.md](../references/design-patterns.md) — the anti-pattern list you flag in step 6.

## Steps

Run the steps in order. Each step outputs one section of the final explanation; skip none.

### Step 0 — Sanity-check the input

Confirm the input is workflow JSON before reading anything else. Accept two forms: `drawflow` as an object holding `nodes` and `edges`, or the legacy form that serializes `drawflow` as a JSON string. Import normalizes the string form to the object graph (see [Stored form vs export form](../references/workflow-json-schema.md#stored-form-vs-export-form) and the `convertWorkflowData.js` implementation). Analyze the normalized object form; note the conversion in your report.

Stop and ask for a real workflow file when the input has neither form — a catalog dump, a node fragment, or non-JSON is not analyzable.

Accept only the object graph or the legacy string form — see [workflow-json-schema.md §Stored form vs export form].

```json
{ "drawflow": { "nodes": [], "edges": [], "zoom": 1.3 } }
```

Pass: the object graph is present — continue. A file holding only `{ "name": "X" }` fails — stop and ask for a real workflow file.

### Step 1 — Read the envelope

Report the identity card: `name`, `description`, `icon`, `version` (stored form) or `extVersion` (export form), the five settings, `globalData` (parse the JSON string), the trigger type, and the table columns.

Read the trigger type from the trigger node's `data.type` — the top-level `trigger` field is `null` in exports, because exports drop it (see [Top-level schema](../references/workflow-json-schema.md#top-level-schema) and [Stored form vs export form](../references/workflow-json-schema.md#stored-form-vs-export-form)). Name the type from the catalog's trigger list: `manual`, `interval`, `date`, `days`, `startup`, `cron`, `contextmenu`, `on-website`, `shortcut`, `custom-event`. Compare each setting against the [settings](../references/workflow-json-schema.md#settings) defaults and report every non-default value plus its meaning — `execContext` runtime limits, `onError` policy. Read `table` and its legacy alias `dataColumns`; both name the same columns.

Report the five settings and the trigger node's type — see [workflow-json-schema.md §Top-level schema, §settings].

```json
{
  "name": "Price checker",
  "settings": { "blockDelay": 0, "saveLog": true, "debugMode": false, "execContext": "background", "onError": "stop-workflow" },
  "globalData": "{\"baseUrl\": \"https://example.com\"}",
  "table": [{ "name": "title", "type": "Text" }]
}
```

Report: name "Price checker"; Background mode (about a 5-minute limit, no popup needed); any error stops the workflow; `globalData` holds `baseUrl`; the table has one Text column `title`.

### Step 2 — Enumerate blocks

List every `drawflow.nodes[]` entry: `id` → `label` → what the block does. Resolve labels against the catalog — [How blocks are identified in JSON](../references/block-reference.md#how-blocks-are-identified-in-json), [Common blocks in depth](../references/block-reference.md#common-blocks-in-depth), and [Full catalog](../references/block-reference.md#full-catalog-61-blocks-grouped-by-category). Capture the position for orientation. Capture data highlights per type: the URL for `new-tab`/`link`/`webhook`, the selector for `get-text`/`event-click`, the method for `webhook`, the `loopId` for loops. Flag `data.disableBlock: true`: the block never runs, though its edges may remain in the graph.

A label absent from the catalog is a custom or business block (see [Caveats](../references/block-reference.md#caveats)) — mark it unknown and ask the user.

Resolve every label; highlight key data; flag disabled blocks — see [block-reference.md §How blocks are identified in JSON, §Full catalog].

```json
{
  "id": "n3",
  "label": "get-text",
  "position": { "x": 96, "y": 230 },
  "data": { "selector": ".product-title", "assignVariable": true, "variableName": "productTitle", "saveData": true, "dataColumn": "title", "disableBlock": false }
}
```

→ `n3` (get-text): reads `.product-title`, writes variable `productTitle` and table column `title`; enabled.

### Step 3 — Map the graph

Resolve every edge to a source and a target node. Parse `sourceHandle` as `${sourceId}-output-<index>` and `targetHandle` as `${targetId}-input-1`; match both ids against `drawflow.nodes`. Classify each output index: `-output-1` is the default next block; a `conditions` block names one output per condition id; output index ≥ 2 on `conditions`, `BlockBasicWithFallback`, and `BlockBasic` carries `fallback` (see [Edges & branches](../references/workflow-json-schema.md#edges--branches)). Record the resolution table `source → sourceHandle → target`. Build the execution order by walking `-output-1` chains from the trigger node; note every branch point and every merge.

An edge whose source or target names no node in `nodes` is a dangling edge — flag it.

Resolve handles exactly; classify default, condition, and fallback outputs — see [workflow-json-schema.md §Edges & branches].

```json
{
  "source": "condNode1",
  "sourceHandle": "condNode1-output-in-stock",
  "target": "thenNode",
  "targetHandle": "thenNode-input-1"
}
```

→ `condNode1` branches to `thenNode` on the condition id `in-stock`; `condNode1-output-fallback` would carry the else path when wired.

### Step 4 — Trace control flow

Start at the trigger node and walk the edges from step 3. Name four constructs:

- **Parallel branches** — a block feeding ≥2 next blocks; the engine spawns one worker per next block ([Execution semantics](../references/workflow-json-schema.md#execution-semantics), [Each extra output connection spawns a parallel worker](../references/design-patterns.md#each-extra-output-connection-spawns-a-parallel-worker)). Note a `wait-connections` block when it joins them.
- **Loops** — a `loop-data` or `loop-elements` node whose `loopId` matches a `loop-breakpoint` node's `loopId` at the end of the body; such a loop without its breakpoint runs once, no error (see [Give every loop-data/loop-elements loop a Loop Breakpoint](../references/design-patterns.md#give-every-loop-dataloop-elements-loop-a-loop-breakpoint-with-the-same-loop-id-repeat-task-takes-none)). A `repeat-task` loop takes NO breakpoint — it iterates via continuation edges back into the repeat-task node's input-1 and exits via output-1; a breakpoint wired to a repeat-task loopId crashes the workflow with `Can't find a loop with "<loopId>" loop id` (verified: handlerRepeatTask.js, handlerLoopBreakpoint.js). Name the loop body: everything between the loop node and its breakpoint.
- **Conditions** — each condition id names a branch; check the edges on every condition output and on the fallback output ([Conditions route to a matching condition output or the fallback](../references/design-patterns.md#conditions-route-to-a-matching-condition-output-or-the-fallback)).
- **Nested workflows** — each `execute-workflow` node targets another workflow; list the ids and, in export files, the matching entries of `includedWorkflows` (see [Stored form vs export form](../references/workflow-json-schema.md#stored-form-vs-export-form)).

Name every `loop-data`/`loop-elements` loop with its breakpoint and every `repeat-task` loop as breakpoint-free; name every branch with its condition id — see [workflow-json-schema.md §Execution semantics; design-patterns.md §Give every loop-data/loop-elements loop a Loop Breakpoint, §Conditions route to a matching condition output].

```json
[
  { "id": "loop1", "label": "loop-data", "data": { "loopId": "products" } },
  { "id": "bp1", "label": "loop-breakpoint", "data": { "loopId": "products" } }
]
```

→ `loop1` pairs with `bp1` on `loopId` "products": the blocks between them iterate per item; `bp1` returns control to `loop1` for the next item.

### Step 5 — Trace data flow

Find every `{{...}}` tag in node `data`. Only `refDataKeys` fields template, so read the field lists in [Common blocks in depth](../references/block-reference.md#common-blocks-in-depth) before hunting. Classify each tag by namespace — `variables`, `table`, `globalData`, `loopData.<loopId>`, `secrets@name`, `prevBlockData`, `workflow.<executeId>`, `activeTabUrl`, `googleSheets.<key>` (see [Namespaces](../references/state-and-expressions.md#namespaces), [Global data](../references/state-and-expressions.md#global-data), [Secrets](../references/state-and-expressions.md#secrets), [Loop data](../references/state-and-expressions.md#loop-data)).

Then record every write: `get-text` and `attribute-value` with `assignVariable` or with `saveData` + `dataColumn` append a table row; `insert-data` appends rows; `increase-variable` mutates a variable; `webhook` with `assignVariable`/`saveData` stores responses; `javascript-code` returns values. Trigger parameters inject as `variables` ([Variables](../references/state-and-expressions.md#variables), [Table](../references/state-and-expressions.md#table)).

Close with the state contract: inputs (trigger parameters, expected variables/globalData) and outputs (table rows, variables, notifications).

List every namespace read; name the block behind every write — see [state-and-expressions.md §Namespaces, §Variables, §Table].

```json
{ "label": "new-tab", "data": { "url": "{{globalData.baseUrl}}/search?q={{variables.keyword}}" } }
```

→ reads `globalData.baseUrl` and `variables.keyword`; `keyword` enters via the trigger parameter of the same name.

### Step 6 — Produce the explanation

Write the plain-language summary in five parts:

1. Goal — one sentence on what the workflow accomplishes.
2. Run path — trigger type, then the block sequence from step 3.
3. Branches and loops — every branch with its condition; every loop-data/loop-elements loop named with its breakpoint; repeat-task loops are breakpoint-free; every parallel fan-out.
4. State — inputs and outputs from step 5; settings worth knowing: `execContext` runtime limits, `onError` policy, `debugMode`, `saveLog`.
5. Design smells — check the graph against the anti-pattern table ([Common design anti-patterns](../references/design-patterns.md#common-design-anti-patterns)): dangling branches, hardcoded URLs, conditions without fallback, loops without breakpoints, web-interaction before an active tab, secrets in block options. Also note robustness gaps, such as extraction without [waiting for dynamic elements](../references/design-patterns.md#wait-for-dynamic-elements-before-interacting).

Flag every smell present; invent none. State each smell as a symptom and a fix.

Flag what the file shows, nothing more — see [design-patterns.md §Common design anti-patterns].

> Smell: `condNode` has no `fallback` edge — an unmatched condition dead-ends and halts the loop. Fix: wire the `fallback` output to the loop breakpoint or a handler block.

## Examples

Worked example — a 6-node price-checking workflow with one condition and one loop.

```json
{
  "id": "WfPriceCheck",
  "name": "Price checker",
  "description": "Searches the store and records in-stock product titles.",
  "icon": "riGlobalLine",
  "folderId": null,
  "content": null,
  "connectedTable": null,
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
          "parameters": [
            { "label": "keyword", "value": "keyboard", "type": "string" }
          ],
          "preferParamsInTab": false,
          "observeElement": {
            "selector": "",
            "baseSelector": "",
            "matchPattern": "",
            "targetOptions": { "subtree": false, "childList": true, "attributes": false, "attributeFilter": [], "characterData": false },
            "baseElOptions": { "subtree": false, "childList": true, "attributes": false, "attributeFilter": [], "characterData": false }
          }
        }
      },
      {
        "id": "tabNode",
        "label": "new-tab",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 230 },
        "data": {
          "disableBlock": false,
          "url": "{{globalData.baseUrl}}/search?q={{variables.keyword}}",
          "userAgent": "",
          "active": true,
          "tabZoom": 1,
          "inGroup": false,
          "waitTabLoaded": true,
          "updatePrevTab": false,
          "customUserAgent": false
        }
      },
      {
        "id": "loopNode",
        "label": "loop-data",
        "type": "BlockRepeatTask",
        "position": { "x": 96, "y": 384.5 },
        "data": {
          "disableBlock": false,
          "loopId": "products",
          "maxLoop": 0,
          "toNumber": 10,
          "fromNumber": 1,
          "startIndex": 0,
          "loopData": "[{\"name\": \"Widget\", \"stock\": \"In stock\"}, {\"name\": \"Gadget\", \"stock\": \"Sold out\"}]",
          "variableName": "row",
          "referenceKey": "",
          "reverseLoop": false,
          "elementSelector": "",
          "waitForSelector": false,
          "waitSelectorTimeout": 5000,
          "resumeLastWorkflow": false,
          "loopThrough": "data-columns"
        }
      },
      {
        "id": "getTextNode",
        "label": "get-text",
        "type": "BlockBasic",
        "position": { "x": 96, "y": 539 },
        "data": {
          "disableBlock": false,
          "findBy": "cssSelector",
          "waitForSelector": false,
          "waitSelectorTimeout": 5000,
          "selector": ".product-title",
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
        "id": "condNode",
        "label": "conditions",
        "type": "BlockConditions",
        "position": { "x": 96, "y": 693.5 },
        "data": {
          "disableBlock": false,
          "conditions": [
            {
              "id": "in-stock",
              "expression": {
                "valueType": "element#text",
                "value": "In stock",
                "data": { "selector": ".stock" },
                "compareType": "cnt"
              }
            }
          ],
          "retryConditions": false,
          "retryCount": 10,
          "retryTimeout": 1000
        }
      },
      {
        "id": "breakNode",
        "label": "loop-breakpoint",
        "type": "BlockLoopBreakpoint",
        "position": { "x": 96, "y": 848 },
        "data": {
          "disableBlock": false,
          "loopId": "products"
        }
      }
    ],
    "edges": [
      { "source": "triggerNode", "target": "tabNode", "sourceHandle": "triggerNode-output-1", "targetHandle": "tabNode-input-1", "id": "edge-1" },
      { "source": "tabNode", "target": "loopNode", "sourceHandle": "tabNode-output-1", "targetHandle": "loopNode-input-1", "id": "edge-2" },
      { "source": "loopNode", "target": "getTextNode", "sourceHandle": "loopNode-output-1", "targetHandle": "getTextNode-input-1", "id": "edge-3" },
      { "source": "getTextNode", "target": "condNode", "sourceHandle": "getTextNode-output-1", "targetHandle": "condNode-input-1", "id": "edge-4" },
      { "source": "condNode", "target": "breakNode", "sourceHandle": "condNode-output-in-stock", "targetHandle": "breakNode-input-1", "id": "edge-5" }
    ],
    "zoom": 1.3
  },
  "table": [{ "name": "title", "type": "Text" }],
  "dataColumns": [],
  "trigger": null,
  "createdAt": 1780000000000,
  "updatedAt": 1780000000000,
  "isDisabled": false,
  "settings": {
    "blockDelay": 0,
    "saveLog": true,
    "debugMode": false,
    "execContext": "background",
    "onError": "stop-workflow"
  },
  "version": "1.29.12",
  "globalData": "{\"baseUrl\": \"https://example.com\"}"
}
```

### Analysis the agent should produce

Run the six steps; the output reads as follows.

```text
Step 1 — Identity card
- name: "Price checker"; description: "Searches the store and records in-stock product titles."
- icon: riGlobalLine; written by extension version 1.29.12
- settings: blockDelay 0, saveLog true, debugMode false, execContext "background", onError "stop-workflow"
- globalData: { baseUrl: "https://example.com" }
- trigger: manual; parameter "keyword" (default "keyboard") injects as {{variables.keyword}}
- table: one Text column "title"; dataColumns is the empty legacy alias

Step 2 — Blocks (6 nodes, all enabled)
- triggerNode (trigger) at (96, 75.5): starts the workflow manually; declares parameter keyword
- tabNode (new-tab) at (96, 230): opens {{globalData.baseUrl}}/search?q={{variables.keyword}}; waits for the tab to load
- loopNode (loop-data) at (96, 384.5): iterates a hardcoded 2-item list, loopId "products", current item as variable "row"
- getTextNode (get-text) at (96, 539): reads .product-title; writes variable productTitle and table column "title"
- condNode (conditions) at (96, 693.5): one rule "in-stock" — element .stock text contains "In stock"
- breakNode (loop-breakpoint) at (96, 848): loopId "products"

Step 3 — Graph map (5 edges, all resolvable)
- triggerNode-output-1 → tabNode (default)
- tabNode-output-1 → loopNode (default)
- loopNode-output-1 → getTextNode (default; loop body start)
- getTextNode-output-1 → condNode (default)
- condNode-output-in-stock → breakNode (condition "in-stock" branch)
- condNode-output-fallback: no edge
Execution order: trigger → tab → loop → [get-text → conditions] per item → breakpoint → next item

Step 4 — Control flow
- trigger: manual
- loop "products": loopNode pairs with breakNode on loopId "products"; body = getTextNode → condNode
- branch "in-stock": continues to the breakpoint (next iteration)
- fallback: unwired — an out-of-stock item dead-ends and halts the loop
- parallel branches: none (every block has one outgoing edge)
- nested workflows: none (no execute-workflow block; no includedWorkflows key in this stored form)

Step 5 — Data flow
- reads: {{globalData.baseUrl}} and {{variables.keyword}} (tabNode); loopData.products implicit — getTextNode and condNode run per item
- writes: variables.productTitle (getTextNode, assignVariable); table row "title" (getTextNode, saveData + dataColumn)
- input contract: parameter keyword, set at run time; globalData.baseUrl, set in the workflow definition
- output contract: one "title" table row per in-stock item; variable productTitle holds the last read title
- namespaces used: variables, globalData, loopData. Not used: table, secrets, prevBlockData, workflow, googleSheets, activeTabUrl

Step 6 — Explanation
Goal: search the store for a keyword and record the titles of products that show "In stock".
How it runs: a manual run opens the search URL in a new tab, then loops over two hardcoded
products; per item it reads the title and keeps it only when the .stock element contains
"In stock".
Branches and loops: one loop ("products", breakpoint present and matched); one branch
("in-stock"); the fallback output is unwired.
State: reads globalData.baseUrl and the keyword parameter; writes table column "title" and
variable productTitle.
Settings: Background mode (about a 5-minute limit, no popup needed); onError stops the
whole workflow; logs saved.
Smells:
  1. condNode has no fallback edge — the first out-of-stock item ends the run silently.
     Fix: wire condNode-output-fallback to breakNode (skip the item) or to a handler block.
  2. getTextNode has waitForSelector off — extraction races a slow search page. Fix: enable
     "wait for selector" or insert an element-exists check before it.
  3. loopData is a hardcoded JSON list — editing the items means editing the workflow. Fix:
     read the list from globalData, a variable, or the table.
  Good: the URL reads globalData instead of hardcoding the domain; the loop has its breakpoint.
```

## Clarification Triggers

Ask the user before proceeding if:
- The input has neither the object graph nor the legacy string `drawflow` (step 0 fails).
- A label never resolves in the catalog — it may be a custom business block ([Caveats](../references/block-reference.md#caveats)).
- The user asks to fix the workflow, not explain it — an explanation alone does not change behavior.
- The file is an export and the user wants origin facts — exports drop `id`, `createdAt`, `updatedAt`, and `isDisabled` ([Stored form vs export form](../references/workflow-json-schema.md#stored-form-vs-export-form)).

## Acceptance Criteria

- Step 0 accepts the object graph and the legacy string form; it stops and asks for a real file on anything else.
- The identity card names the workflow, the trigger type, and every non-default setting; it lists the `globalData` keys and the table columns.
- Every node appears in the enumeration with a resolved label, key data highlights, and a disabled flag wherever `disableBlock` is true.
- Every edge resolves to a real source and target node; each branch is classified as default (`-output-1`), condition id, or `fallback`.
- Every loop-data/loop-elements loop names its `loopId` and its breakpoint pairing; repeat-task loops pair with no breakpoint (a breakpoint on a repeat-task loopId crashes the workflow).
- Every `{{...}}` namespace in the file appears in the state summary, each with the block that reads it and the block that writes it.
- The final explanation covers goal, run path, branches/loops, state, settings, and smells.
- Every smell present in the file appears with a symptom and a fix; the output invents no smell.
- The output reads as plain language: a reader who has never seen Automa can restate the workflow's behavior.
