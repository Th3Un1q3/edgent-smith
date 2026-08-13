# Reference: Automa Block Catalog

The factual backbone for choosing blocks and reading existing workflows. The registry contains **61 core blocks** in 7 categories.

When to load: before picking a block, before writing a block's `data` object, or when reading an unfamiliar workflow's node labels.

## Vocabulary

- **block:** a workflow node with a `label`, `data` options, `inputs`, and `outputs`. Workflow JSON nodes are blocks.
- **label:** the registry key of a block (e.g. `new-tab`). This string appears in the node's `label` field in workflow JSON. Never invent one.
- **display name:** the human-readable name (e.g. "New tab"). Comes from the registry `name` field, i18n'd via `src/locales/en/blocks.json`. The label, not the display name, goes in JSON.
- **component:** the UI renderer class (`BlockBasic`, `BlockConditions`, `BlockBasicWithFallback`, `BlockDelay`, `BlockRepeatTask`, `BlockElementExists`, `BlockGroup`, `BlockLoopBreakpoint`, `BlockPackage`, `BlockNote`). It determines visible outputs and editing UI.
- **output index:** the connection handle on a block's right side. Output 1 (`-output-1`) is the default next connection; `outputs > 1` adds extra handles.
- **refDataKeys:** the `data` fields that receive `{{}}` templating. Fields not listed do not interpolate. Templating syntax lives in `state-and-expressions.md`.
- **category:** the registry category id (`general`, `browser`, `interaction`, `conditions`, `data`, `onlineServices`, `package`), which maps to a sidebar group.

## How blocks are identified in JSON

A block node in workflow JSON carries `"label": "<registry key>"`. For example, the HTTP-request block is `"label": "webhook"` even though its display name is "HTTP Request". Read labels, not display names, when parsing a workflow. Defaults for the node's `data` object come from the registry `data` field; a workflow usually stores the full default object plus user edits.

## Category map

| Category id | Display name | Blocks |
|---|---|---|
| `general` | General | trigger, ai-workflow, execute-workflow, delay, export-data, webhook, blocks-group, clipboard, wait-connections, notification, note, workflow-state, parameter-prompt |
| `browser` | Browser | active-tab, new-tab, switch-tab, new-window, proxy, go-back, forward-page, close-tab, take-screenshot, browser-event, handle-dialog, handle-download, reload-tab, tab-url, cookie |
| `interaction` | Web interaction | event-click, get-text, element-scroll, link, attribute-value, forms, javascript-code, trigger-event, switch-to, upload-file, hover-element, save-assets, press-key, create-element |
| `conditions` | Control flow | repeat-task, conditions, element-exists, while-loop, loop-data, loop-elements, loop-breakpoint |
| `data` | Data | insert-data, delete-data, log-data, slice-variable, increase-variable, regex-variable, data-mapping, sort-data |
| `onlineServices` | Online services | google-sheets, google-sheets-drive, google-drive |
| `package` | Packages | block-package |

## Common blocks in depth

Key `data` fields below are the registry defaults.

### trigger (Trigger) — general

Starts the workflow. Only one trigger per workflow (`maxConnection: 1`, `inputs: 0`). Fires on the `type` schedule: `manual` (default), `interval` (seconds via `interval`), `date`, `days`, `startup`, `cron`, `contextmenu`, `on-website`, `shortcut`, or `custom-event`.

Key fields: `disableBlock`, `description`, `type` ('manual'), `interval` (60), `delay` (5), `date`, `time` ('00:00'), `url`, `shortcut`, `activeInInput`, `isUrlRegex`, `days` ([]), `contextMenuName`, `contextTypes` ([]), `parameters` ([]), `preferParamsInTab`, `observeElement` ({selector, baseSelector, matchPattern, targetOptions, baseElOptions}). `refDataKeys: ['url']`.

```json
{
  "id": "0",
  "label": "trigger",
  "type": "BlockBasic",
  "data": {
    "type": "interval",
    "interval": 60,
    "delay": 5,
    "days": [],
    "parameters": []
  }
}
```

### webhook (HTTP Request) — general

Sends an HTTP request. **Label quirk:** the JSON label is `webhook`; the display name is "HTTP Request". `component: BlockBasicWithFallback`, `outputs: 2` (success + `fallback`).

Key fields: `url`, `body` ('{}'), `headers` ([]), `method` ('POST'), `timeout` (10000), `dataPath`, `contentType` ('json'), `variableName`, `assignVariable`, `saveData`, `dataColumn`, `responseType` ('json'). `refDataKeys: ['body', 'url', 'variableName']`.

```json
{
  "id": "1",
  "label": "webhook",
  "type": "BlockBasicWithFallback",
  "data": {
    "url": "https://api.example.com/items",
    "method": "GET",
    "body": "{}",
    "headers": [],
    "contentType": "json",
    "responseType": "json",
    "timeout": 10000,
    "saveData": true,
    "dataColumn": "response"
  }
}
```

### new-tab — browser

Opens a URL in a new tab. First browser block in most workflows: web-interaction blocks require an active tab.

Key fields: `url`, `userAgent`, `active` (true), `tabZoom` (1), `inGroup`, `waitTabLoaded`, `updatePrevTab`, `customUserAgent`. `refDataKeys: ['url', 'userAgent']`.

```json
{
  "id": "2",
  "label": "new-tab",
  "type": "BlockBasic",
  "data": {
    "url": "https://example.com",
    "active": true,
    "waitTabLoaded": false,
    "inGroup": false
  }
}
```

### event-click (Click Element) — interaction

Clicks a matched element. Shares the `EditInteractionBase` editor with hover-element.

Key fields: `findBy` ('cssSelector'), `waitForSelector`, `waitSelectorTimeout` (5000), `selector`, `markEl`, `multiple`. `refDataKeys: ['selector']`.

### get-text (Get Text) — interaction

Extracts text from matched elements into a variable, table, or both.

Key fields: `findBy` ('cssSelector'), `waitForSelector`, `waitSelectorTimeout` (5000), `selector`, `markEl`, `multiple`, `regex`, `prefixText`, `suffixText`, `regexExp` ([]), `dataColumn`, `saveData` (true), `includeTags`, `addExtraRow`, `assignVariable`, `useTextContent`, `variableName`, `extraRowValue`, `extraRowDataColumn`. `refDataKeys: ['selector', 'variableName', 'prefixText', 'suffixText', 'extraRowValue']`.

```json
{
  "id": "3",
  "label": "get-text",
  "type": "BlockBasic",
  "data": {
    "selector": "h1.product-title",
    "findBy": "cssSelector",
    "waitForSelector": true,
    "waitSelectorTimeout": 5000,
    "multiple": false,
    "saveData": true,
    "dataColumn": "title",
    "assignVariable": true,
    "variableName": "productTitle"
  }
}
```

### conditions — control flow

Branches on condition rules. `component: BlockConditions`; the registry lists `outputs: 0` because the count is dynamic — the block exposes **one output per condition** (each named by its condition id) plus a `fallback` output. Build conditions with `conditionBuilder` rules (value compares, data exists, element text/exists/visible/attribute).

Key fields: `conditions` ([]), `retryConditions`, `retryCount` (10), `retryTimeout` (1000).

```json
{
  "id": "4",
  "label": "conditions",
  "type": "BlockConditions",
  "data": {
    "conditions": [
      {
        "id": "cond-1",
        "expression": {
          "valueType": "element#text",
          "value": "In stock",
          "data": { "selector": ".status" },
          "compareType": "cnt"
        }
      }
    ],
    "retryConditions": false,
    "retryCount": 10,
    "retryTimeout": 1000
  }
}
```

### loop-data (Loop Data) — control flow

Iterates over a JSON list (`loopData`, default '[]'), a number range (`fromNumber`/`toNumber`), or page elements (`elementSelector`). Paired with a `loop-breakpoint` block carrying the same `loopId`.

Key fields: `loopId`, `maxLoop` (0), `toNumber` (10), `fromNumber` (1), `startIndex` (0), `loopData` ('[]'), `variableName`, `referenceKey`, `reverseLoop`, `elementSelector`, `waitForSelector`, `waitSelectorTimeout` (5000), `resumeLastWorkflow`, `loopThrough` ('data-columns'). `refDataKeys: ['maxLoop', 'loopData', 'selector', 'startIndex', 'variableName', 'referenceKey', 'elementSelector']`.

```json
{
  "id": "5",
  "label": "loop-data",
  "type": "BlockRepeatTask",
  "data": {
    "loopId": "loop-1",
    "loopData": "[{\"id\": 1}, {\"id\": 2}]",
    "loopThrough": "data-columns",
    "maxLoop": 0,
    "startIndex": 0,
    "variableName": "row"
  }
}
```

### loop-elements (Loop Elements) — control flow

Iterates over page elements matched by `selector`, optionally clicking a "load more" trigger while scanning.

Key fields: `loopId`, `selector`, `maxLoop` ('0'), `reverseLoop`, `actionElSelector`, `findBy` ('cssSelector'), `actionElMaxWaitTime` (5), `actionPageMaxWaitTime` (10), `loadMoreAction` ('none'), `scrollToBottom` (true), `waitForSelector`, `waitSelectorTimeout` (5000). `refDataKeys: ['maxLoop', 'selector', 'variableName', 'elementSelector', 'actionElSelector']`.

### javascript-code — interaction

Runs custom JavaScript in the page. Must call `automaNextBlock()` (or `return`) to continue the workflow.

Key fields: `timeout` (20000), `context` ('website'), `code`, `preloadScripts` ([]), `everyNewTab`, `runBeforeLoad`. No `refDataKeys` — the editor handles interpolation via its own variable helpers.

```json
{
  "id": "6",
  "label": "javascript-code",
  "type": "BlockBasic",
  "data": {
    "context": "website",
    "code": "const el = document.querySelector('.price');\nreturn { price: el?.textContent };\n// or call automaNextBlock() when not returning data",
    "timeout": 20000,
    "preloadScripts": [],
    "runBeforeLoad": false,
    "everyNewTab": false
  }
}
```

Runtime scope (verified against `AutomaApp/automa` source): `data.code` executes raw — `{{...}}` mustache tags are NOT interpolated inside javascript-code blocks (the editor's variable autocomplete writes raw JS, not templates). In-scope globals: `automaRefData(keyword, path)`, `automaSetVariable(name, value)`, `automaNextBlock(data, insert)`, `automaResetTimeout()`, `automaFetch(type, resource)`. Read variables with `automaRefData('variables', '<name>')`. The workflow-engine handler forwards real variables only when `data.code` literally contains the string `automaRefData`.

### delay — general

Pauses execution. Key fields: `time` (500, milliseconds). `refDataKeys: ['time']`. Example: `{"label": "delay", "type": "BlockDelay", "data": {"time": 2000}}`.

### execute-workflow — general

Runs another workflow by ID (`executeId`/`workflowId`), optionally passing `globalData` or importing its variables. Key fields: `executeId`, `workflowId`, `globalData`, `insertAllVars`, `insertAllGlobalData`. `refDataKeys: ['globalData']`.

### Data-utility blocks — data

- **increase-variable:** adds `increaseBy` (1) to `variableName`.
- **slice-variable:** extracts a slice of `variableName`; `startIdxEnabled` (true), `endIdxEnabled` (false), `startIndex` (0), `endIndex` (0).
- **regex-variable:** matches (`method` 'match') or replaces (`method` 'replace' with `replaceVal`) `expression` against `variableName`; `flag` ([]).

## Branch, fallback, and parallel connections

- Output 1 (`-output-1`) is every block's default next connection. `inputs` and `outputs` counts come from the registry; every core block has `maxConnection: 1` (one incoming connection).
- `outputs: 2` blocks expose a second handle:
  - **`conditions`** — dynamic outputs: one per condition (named by condition id) plus `fallback` (registry shows `outputs: 0` because the count depends on the conditions array).
  - **`element-exists`** — output 2 fires when the element is not found.
  - **`repeat-task`** — output 2 repeats the connected loop body.
  - **`webhook`** and **`while-loop`** — `component: BlockBasicWithFallback` renders an extra `fallback` output, used by the on-error "Execute fallback" behavior.
- Multiple connections from the same output index of one block run **in parallel** (all branches execute; `wait-connections` then joins them).
- On-error fallback is unavailable for: note, delay, webhook, trigger, while-loop, conditions, blocks-group, block-package, element-exists (`excludeOnError` in `shared.js`).

## Typical minimal-workflow compositions

- **Scrape one item:** trigger → new-tab → get-text → insert-data.
- **Automate a form:** trigger → new-tab → forms → event-click → insert-data.
- **Scrape a list:** trigger → new-tab → loop-data (or loop-elements) → get-text → insert-data → loop-breakpoint; the breakpoint's `loopId` must match the loop block's `loopId`.
- **Branch:** trigger → new-tab → conditions → one branch per condition output, plus `fallback` for the else path.
- **Call an API:** trigger → webhook → insert-data (the block's JSON label is `webhook`).
- **Rule of thumb:** every web-interaction block (event-click, get-text, forms, …) needs an active tab first — start with `new-tab` or `active-tab`.

## Full catalog (61 blocks, grouped by category)

### General (`general`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `trigger` | Trigger | Starts the workflow on a schedule, event, or manual run |
| `ai-workflow` | AI Workflow | Runs an AI-generated workflow (tagged "AI") |
| `execute-workflow` | Execute Workflow | Runs another workflow by ID |
| `delay` | Delay | Pauses before the next block |
| `export-data` | Export Data | Exports table data as JSON, CSV, or plain text |
| `webhook` | HTTP Request | Sends an HTTP request — **label is `webhook`** |
| `blocks-group` | Blocks Group | Groups blocks into a folder |
| `clipboard` | Clipboard | Reads or writes the clipboard |
| `wait-connections` | Wait Connections | Waits for all incoming connections to finish |
| `notification` | Notification | Displays a system notification |
| `note` | Note | Free-form text note; no execution |
| `workflow-state` | Workflow State | Stops the current or other workflows |
| `parameter-prompt` | Parameter Prompt | Prompts the user for parameters before running |

### Browser (`browser`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `active-tab` | Active Tab | Uses the current tab |
| `new-tab` | New Tab | Opens a URL in a new tab |
| `switch-tab` | Switch Tab | Switches the active tab |
| `new-window` | New Window | Opens a new browser window |
| `proxy` | Proxy | Sets the browser proxy |
| `go-back` | Go Back | Navigates to the previous page |
| `forward-page` | Go Forward | Navigates to the next page |
| `close-tab` | Close Tab/Window | Closes a tab or window |
| `take-screenshot` | Take Screenshot | Captures the active tab |
| `browser-event` | Browser Event | Waits for a browser event (e.g. tab loaded) |
| `handle-dialog` | Handle Dialog | Accepts or dismisses JS dialogs |
| `handle-download` | Handle Download | Watches and handles downloads |
| `reload-tab` | Reload Tab | Reloads the active tab |
| `tab-url` | Get Tab URL | Reads the active tab's URL or title |
| `cookie` | Cookie | Gets, sets, or removes cookies |

### Web interaction (`interaction`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `event-click` | Click Element | Clicks a matched element |
| `get-text` | Get Text | Extracts text from matched elements |
| `element-scroll` | Scroll Element | Scrolls an element or the page |
| `link` | Link | Opens a link element (optionally in a new tab) |
| `attribute-value` | Attribute Value | Gets or sets an element attribute |
| `forms` | Forms | Manipulates input, select, checkbox, and radio elements |
| `javascript-code` | JavaScript Code | Runs custom JS in the page |
| `trigger-event` | Trigger Event | Fires a DOM event on an element |
| `switch-to` | Switch Frame | Switches between main window and iframe — docs name "Switch Frame" |
| `upload-file` | Upload File | Uploads a file into an `input[type=file]` |
| `hover-element` | Hover Element | Hovers over a matched element |
| `save-assets` | Save Assets | Saves an image/video/audio/file from an element or URL |
| `press-key` | Press Key | Presses a key or key combination |
| `create-element` | Create Element | Creates an element and inserts it into the page |

### Control flow (`conditions`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `repeat-task` | Repeat Task | Repeats connected blocks N times |
| `conditions` | Conditions | Branches on conditions; one output per condition plus fallback |
| `element-exists` | Element Exists | Branches on whether an element exists |
| `while-loop` | While Loop | Loops while a condition holds |
| `loop-data` | Loop Data | Iterates over a data list or number range |
| `loop-elements` | Loop Elements | Iterates over page elements |
| `loop-breakpoint` | Loop Breakpoint | Stops the enclosing loop; must match the loop's `loopId` |

### Data (`data`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `insert-data` | Insert Data | Appends rows to a table |
| `delete-data` | Delete Data | Removes table or variable data |
| `log-data` | Get Log Data | Reads the latest log of a workflow |
| `slice-variable` | Slice Variable | Extracts a substring of a variable |
| `increase-variable` | Increase Variable | Adds a fixed amount to a variable |
| `regex-variable` | RegEx Variable | Matches or replaces a variable against a regular expression |
| `data-mapping` | Data Mapping | Maps table or variable data |
| `sort-data` | Sort Data | Sorts data items |

### Online services (`onlineServices`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `google-sheets` | Google Sheets | Reads/writes Google Sheets via the Sheets API |
| `google-sheets-drive` | Google Sheets (GDrive) | Google Sheets access via Google Drive |
| `google-drive` | Google Drive | Uploads files to Google Drive |

### Packages (`package`)
| Label (JSON) | Display name | Purpose |
|---|---|---|
| `block-package` | Block Package | Runs a custom block package |

## Caveats

- Display names come from i18n (`src/locales/en/blocks.json`); the registry `name` field holds the English display name. The JSON `label` is always the registry key.
- `switch-to` is labeled "Switch Frame" in the docs and source.
- The `business/` directory can add custom blocks via `getBlocks()` (merged in `src/utils/getSharedData.js`). This catalog covers the 61 core registry blocks only — unknown labels may be business/custom blocks.
- `ai-workflow` blocks are produced by Automa's AI features and reference a generated flow UUID; treat them as opaque in hand-written workflows.
