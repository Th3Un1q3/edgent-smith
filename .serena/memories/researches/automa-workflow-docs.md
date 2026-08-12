# Automa Official Documentation - Workflow Authoring (docs research)

Date: 2026-08-11. Source: AutomaApp/documentation repo (VitePress). Live mirror: docs.automa.site (config sitemap hostname + editLink pattern prove mirror; live-site fetch returned tool error on all pages - content below is verbatim from the repo source of truth). Docs for v1.21.x or below: automa-docs-old.vercel.app.

## Repo structure
- docs/index.md (Introduction), docs/guide/quick-start.md (Quick Start), docs/workflow/* (15 concept pages), docs/blocks/* (65 block reference pages, one per block), docs/reference/* (storage, packages, condition-builder, workflow-common-errors, javascript-execution-context), docs/extension-builder/*, docs/integrations/google-drive.md, docs/parts/blocks-interaction-note.md. Full zh mirror under docs/zh/. Sidebar (category-to-block mapping) lives in docs/.vitepress/config.ts.

## Workflow creation (Quick Start, verbatim steps)
- Two ways: (1) record actions on the web (Record workflow menu in dashboard; also right-click block output > Record from here), (2) manually: 1) Open the Automa dashboard by clicking the Automa icon on the top right. 2) Click the New workflow button and input the name and description for the workflow. 3) And open the workflow that you just created. In the editor a trigger block is present - the workflow starts executing there and scheduling is configured in this block. Add a block: drag a block from the blocks list on the left side and drop it into the canvas. Connect: drag the trigger block output and drop it into the block input. Save the workflow; run via play icon. Danger note: while the workflow is running, do not close the Automa popup (it will not run when you close it).

## Connecting blocks (workflow/blocks.md)
- 4 documented methods: (1) manually dragging the block output into an input of a block; (2) drop a block into a block output; (3) clicking the block output and input; (4) drop a block into another block. Conditional outputs: Conditions block checks every condition; if it matches, the workflow continues to the block that connects with the condition output; if no match, continues to the block connected to the fallback output (blocks/conditions.md). Block on-error option Execute fallback: continue to the block that connects to the fallback output. Loop scope requires a Loop Breakpoint block. Block menu (hover): Delete, Block settings, Move block to group blocks, Enable/disable block, Run (from current block), Edit (double-click too). Block settings: General (Debug mode via CDP for some blocks), On error (Enable, Retry action, Throw error, Continue flow, Execute fallback, Insert data), Lines (Select line, Line label, Animated, Line color).

## 6 block categories (official names + blocks per sidebar)
- General: Trigger, AI Workflow, Execute Workflow, Delay, Export Data, HTTP Request, Blocks Group, Clipboard, Wait Connections, Notification, Workflow State, Parameter Prompt.
- Browser: Active Tab, New Tab, Switch Tab, New Window, Proxy, Go Back, Go Forward, Close Tab/window, Take Screenshot, Browser Event, Handle Dialog, Handle Download, Reload Tab, Get Tab Url, Cookie.
- Web Interaction: Click Element, Get Text, Scroll Element, Link, Attribute Value, Forms, Javascript Code, Trigger Event, Switch Frame, Upload File, Hover Element, Save Assets, Press Key, Create Element. (Before using these, use a New Tab or Active Tab block.)
- Control Flow: Repeat Task, Conditions, Element Exists, While Loop, Loop Data, Loop Elements, Loop Breakpoint.
- Online Services: Google Sheets, Google Sheets (GDrive), Google Drive.
- Data: Insert Data, Delete Data, Get Log Data, Slice Variable, Increase Variable, Regex Variable, Data Mapping, Sort Data.

## Trigger types (blocks/trigger.md)
- Manually, Interval, On a specific date, On a specific day, On browser startup, Cron job, Context menu (injects $ctxElSelector, $ctxTextSelection, $ctxMediaUrl, $ctxLink; requires contextMenu permission), When visiting a website (URL or ReGex with Use regex checkbox), Keyboard shortcut (record button; Active while in input option; not on chrome:// URLs). JS CustomEvent trigger: window.dispatchEvent(new CustomEvent(automa:execute-workflow, { detail: { id or publicId, data: { variables: {...} } } })); fallback event name __automaExecuteWorkflow. Trigger through URL (v1.28.26+): chrome-extension://infppggnoaenmfagbfknfkancpbljcca/execute.html#/workflowId?variableA=value. Parameters defined in trigger block become workflow variables.

## Data system
- Workflow JSON: the workflow in Automa is saved in JSON format - export/import via dashboard menus (workflow/overview.md).
- Variables: store a value accessible throughout the workflow. Name rules: no space, @, or [] in variable name. Prefixes: $$ = storage variable (persisted, see Storage); $push: = append value to array (first assignment makes the value the array first item).
- Global Data: workflow-level JSON object e.g. {url: https://dribbble.com}; access via expression {{globalData.url}}.
- Table: spreadsheet-like, strict column data types Text/Number/Boolean/Array/Any; insert via extraction blocks (Get Text, Attribute Value) with Insert to table option (appends to end row); stored as array of objects; Export Data block exports Text/CSV/JSON. Table vs variable: typed+appends vs untyped+overwrites.
- Storage (reference/storage.md): persisted tables + variables ($$ prefix) + encrypted Credentials (add-only, cannot view after; access via {{secrets@credentialName}}).
- Parameters: defined in trigger block (Parameters button); become variables; access {{variables.keyword}}.
- Workflow Events (workflow/settings.md): Finish (success)/Finish (failed) events with HTTP Request or Execute JS Code actions; workflow data via workflow keyword or automaRefData(workflow, logs); shape: { status: success|error, logs: [{type, description, name, blockId, timestamp, activeTabUrl, duration, id}], errorMessage }.

## Expressions (workflow/expressions.md)
- Mustache templating: {{ keyword }}. v1.21.x or below also supports {{ keyword@path }} syntax (still supported in v1.22.x).
- Data sources: table, variables.<name>, loopData.<loopId>, prevBlockData, globalData, googleSheets.<referenceKey>, activeTabUrl, workflow.<executeId>.
- Indexing: {{variables.socials.0.url}} (array index), {{table.$last}} (last row), {{table.0.color}}; wrap expressions in [] to nest: {{$increment([variables.variableName]}}, {{table.[loopData.loopId.$index].columnName}}.
- Functions (prefix $): $date(date, dateFormat?) day.js formats + relative/timestamp, $randint(min?, max?), $getLength(str), $randData(expression: ?l ?u ?d ?f ?s ?m ?n ?a), $multiply(value, by), $increment(value, by), $divide(value, by), $subtract(value, by), $replace(value, search, replace), $replaceAll(value, search, replace), $toLowerCase(value), $toUpperCase(value), $modulo(num, divisor), $filter(data, JSONPath syntax), $stringify(value).
- JS expressions (Chromium only): prefix !! on the text field; e.g. !!The number is: {{variables.number}}; built-in functions usable; {{Date.now()}}, {{table[table.length - 1].columnName}}.
- Condition Builder value prefixes: string::, json::, number::, boolean::; Code (JS expressions); Data Exists via variables.name or variables@name; Element conditions: text, exists, not exists, visible, visible in screen, hidden in screen, attribute value.

## Looping (workflow/looping.md)
- 3 ways: Loop Data block (variables/table/google sheets/custom JSON array), Loop Elements (page elements), Repeat Task (count + start point). Loop Data/Elements REQUIRE a Loop Breakpoint block with matching Loop id (defines loop scope); without it the loop runs once. Loop item access: {{loopData.loopId}} returns { data, $index }; {{loopData.loopId.$index}}; expression shorthand auto-assigns data (must write .data in JS expressions).

## Troubleshooting
- Workflow Common Errors (reference/workflow-common-errors.md): (1) element-not-found - selector matches nothing; check with Element Exists block or enable Wait for selector option. (2) can-not-find-tab - match patterns match no URL tab; see MDN match patterns. (3) content-body-not-valid-JSON - HTTP Request body not JSON; see webhook.md referencing-data-inside-body guidelines. (4) can-not-connect-to-tab - block needs active tab; put New Tab/Active Tab before it. (5) invalid-URL - URL must start with http/https.
- Testing mode (workflow/testing-mode.md): per-step testing without executing the entire workflow; breakpoints (record-circle icon) pause execution to inspect workflow state and variables.
- Debug mode (workflow/debug-mode.md): Chrome DevTools Protocol to emulate clicks/typing instead of JS API; chromium-only; per-workflow (settings) or per-block (block settings); use for WYSIWYG editors (tweet/Discord typing via Forms) or XY-coordinate clicks via Trigger Event block.
- JS execution context (reference/javascript-execution-context.md): Active Tab (DOM) vs Background (sandbox, no tab needed, console.log visible in Automa dashboard DevTools); CSP blocks injection on some sites - test with inline script; error: Refused to execute inline script because it violates CSP.
- Settings (workflow/settings.md): On workflow error handling; workflow execution popup vs background (popup: no runtime limit, JS expressions/clipboard/JS background execution available; background: ~5 min max, no popup needed); save workflow log (view logs of executions).

## Best practices / tips found in docs
- Use global data for repeated values instead of editing blocks one by one (global-data.md).
- Use parameters instead of editing blocks per run (parameters.md).
- Wait for selector / Element Exists to handle dynamic elements (workflow-common-errors.md).
- Loop Data/Elements must include Loop Breakpoint with matching id or loop silently runs once (looping.md).
- Name variables without space/@/[] for mustache access (variables.md).
- Use Debug mode for WYSIWYG/XY-click sites where JS emulation fails (debug-mode.md).
- JS expressions are Chromium-only (expressions.md).
- Keyboard shortcut trigger disabled on chrome:// URLs (trigger.md).

## Gaps (not covered by docs - needs code research)
- Workflow JSON schema details: no official JSON schema/format spec in the docs repo beyond workflows-are-JSON export/import (fields like id, blocks[], connections, data object undocumented).
- Block JSON properties per type (labels, data keys) - block pages document UI config, not JSON keys.
- Connection JSON representation of next/true/false/fallback outputs (docs describe UI semantics only; conditions doc says condition output + fallback output - the literal true/false label appears in the UI, not verbatim in these pages).
- Internal storage keys, automaRefData internals beyond workflow (docs show usage, not schema).
- Old v1.21.x docs live in separate site automa-docs-old.vercel.app (not in this repo).

## Cached sources

- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-index-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-guide-quick-start-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-overview-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-blocks-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-running-a-workflo
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-vitepress-config-ts
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-variables-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-global-data-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-expressions-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-table-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-table-or-variable
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-parameters-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-settings-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-reference-workflow-common-
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-debug-mode-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-testing-mode-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-reference-storage-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-blocks-conditions-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-blocks-trigger-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-reference-condition-builde
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-workflow-looping-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-blocks-data-mapping-md
- mem:cache/fetch/raw-githubusercontent-com/automaapp-documentation-main-docs-reference-javascript-execu