# Reference: `.automa.json` Workflow File Format

Canonical details of the `.automa.json` workflow file format: the top-level schema, the node and edge format, and the import/export behavior. See [block-reference.md](./block-reference.md) for the per-block option catalog.

When to load: when you write, read, or validate a `.automa.json` file — you need the top-level schema, the node and edge format, or the import/export behavior.

## Vocabulary

- **block:** a unit of automation in Automa — e.g. `trigger`, `new-tab`, `execute-workflow`. The engine runs blocks; the canvas shows them as nodes.
- **node:** one entry in `drawflow.nodes` — a placed block with `id`, `label`, `type`, `position`, and `data`.
- **edge:** one entry in `drawflow.edges` — a directed connection from one node's output to another node's input.
- **handle:** a named connection port on a node. Edges name their endpoints `sourceHandle` and `targetHandle`.
- **drawflow:** the workflow's `drawflow` field — the editor graph `{ nodes, edges, zoom }` that stores the canvas state.
- **label:** the node's `label` field — the block type id (the registry key, e.g. `trigger`, `new-tab`).

## Top-level schema

The workflow object carries identity, metadata, the graph, and runtime settings. `defaultWorkflow` in `src/stores/workflow.js` defines the stored form.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | nanoid; import regenerates it |
| `name` | string | workflow name; export derives the filename `${name}.automa.json` from it |
| `description` | string | free-text description |
| `icon` | string | icon class, e.g. `"riGlobalLine"` |
| `folderId` | string \| null | folder membership; stored form only |
| `content` | null | null in the stored form; `convertWorkflow` names its exported payload `content` and seeds it with `extVersion` |
| `connectedTable` | null | stored form only |
| `drawflow` | object | the graph `{ nodes: [], edges: [], zoom: number }`; the store defaults `zoom` to `1.3` |
| `table` | array | data schema columns |
| `dataColumns` | array | legacy alias of `table`; import folds it into `table` |
| `trigger` | object \| null | trigger configuration |
| `createdAt` | number | millisecond epoch; import resets it to now |
| `updatedAt` | number | millisecond epoch |
| `isDisabled` | boolean | `true` disables the workflow |
| `settings` | object | runtime settings (see the `settings` section) |
| `version` | string | extension version that wrote the file, e.g. `"1.29.12"` |
| `globalData` | string | JSON string, e.g. `"{}"` |

Example — a stored workflow shell.

```json
{
  "id": "WfAbCdEfGhIj",
  "name": "Example",
  "description": "",
  "icon": "riGlobalLine",
  "folderId": null,
  "content": null,
  "connectedTable": null,
  "drawflow": { "nodes": [], "edges": [], "zoom": 1.3 },
  "table": [],
  "dataColumns": [],
  "trigger": null,
  "createdAt": 1780000000000,
  "updatedAt": 1780000000000,
  "isDisabled": false,
  "settings": { "onError": "stop-workflow" },
  "version": "1.29.12",
  "globalData": "{}"
}
```

### settings

`defaultWorkflow` seeds these settings. `onError` is the workflow-level error policy: `keep-running`, `restart-workflow`, or `stop-workflow`.

| Key | Default |
|---|---|
| `blockDelay` | `0` |
| `saveLog` | `true` |
| `debugMode` | `false` |
| `execContext` | `"popup"` |
| `onError` | `"stop-workflow"` |

The store also seeds `publicId`, `aipowerToken`, `restartTimes`, `notification`, `reuseLastState`, `inputAutocomplete`, `executedBlockOnWeb`, `insertDefaultColumn`, and `defaultColumnName`.

Example — the five execution-relevant settings with their defaults.

```json
{
  "blockDelay": 0,
  "saveLog": true,
  "debugMode": false,
  "execContext": "popup",
  "onError": "stop-workflow"
}
```

## Stored form vs export form

The store keeps one object shape; the export writes a trimmed payload with two extra keys. `convertWorkflow` in `src/utils/workflowData.js` builds the payload: it copies `name`, `icon`, `table`, `version`, `drawflow`, `settings`, `globalData`, and `description` onto a fresh object seeded with `extVersion`, falling back to `defaultValue` for any missing key. `exportWorkflow` then adds `includedWorkflows` and writes the file as `${workflow.name}.automa.json`.

- `extVersion` — `browser.runtime.getManifest().version`, the extension version at export time.
- `includedWorkflows` — a map of nested workflow documents referenced by `execute-workflow` blocks. The key always appears in the export; it is `{}` when no nested workflows exist.
- Not exported: `id`, `folderId`, `content`, `connectedTable`, `dataColumns`, `trigger`, `createdAt`, `updatedAt`, `isDisabled`.

Example — the exact key set of an exported file.

```json
{
  "name": "Example",
  "icon": "riGlobalLine",
  "table": [],
  "version": "1.29.12",
  "drawflow": { "nodes": [], "edges": [], "zoom": 1.3 },
  "settings": { "onError": "stop-workflow" },
  "globalData": "{}",
  "description": "",
  "extVersion": "1.29.12",
  "includedWorkflows": {}
}
```

Produce the file from the editor: ⋯ menu → Export. Load a file from the dashboard: arrow-down → "Import workflow".

## Nodes

`drawflow.nodes` holds every block on the canvas. Each node is a block instance: `label` names the block type, `type` names the editor component, and `data` holds the block's options.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | node id — current Automa generates nanoid strings, e.g. `F_uKdk2VrnKslRle78d-C`; edges reference it exactly |
| `label` | string | the block type id (the registry key) — see [block-reference.md](./block-reference.md) for the catalog |
| `type` | string | the editor Vue component name: `BlockBasic`, `BlockConditions`, `BlockBasicWithFallback`, `BlockTrigger`, `BlockDelay`, … — NOT the block id |
| `position` | object | canvas coordinates `{ x: number, y: number }` |
| `data` | object | the block's options; defaults per block type |

Example — a real trigger node.

```json
{
  "id": "F_uKdk2VrnKslRle78d-C",
  "type": "BlockBasic",
  "label": "trigger",
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
  },
  "position": { "x": 96, "y": 75.5 }
}
```

The editor may persist extra Vue Flow bookkeeping fields on stored nodes — `dimensions`, `handleBounds`, `computedPosition`, `selected`, `dragging`, `resizing`, `initialized`. Exports pass `drawflow` through as-is, so real files carry these fields too.

## Edges & branches

`drawflow.edges` stores the connections. Each edge names its source output and target input as handle strings; the engine resolves outgoing connections per output index.

| Field | Type | Meaning |
|---|---|---|
| `source` | string | source node id |
| `target` | string | target node id |
| `sourceHandle` | string | `${sourceNodeId}-output-${outputIndex}`; the first (default) output is `-output-1` |
| `targetHandle` | string | `${targetNodeId}-input-1`; `_` becomes `-` |
| `id` | string | edge id; the editor may add `updatable`, `selectable`, `class` |

Example — one edge from the trigger node's first output.

```json
{
  "source": "F_uKdk2VrnKslRle78d-C",
  "target": "iA7qWn2xLm0Pv",
  "sourceHandle": "F_uKdk2VrnKslRle78d-C-output-1",
  "targetHandle": "iA7qWn2xLm0Pv-input-1",
  "id": "edge-1"
}
```

Example — the `_` → `-` replacement inside `targetHandle`.

```json
{
  "target": "node_1",
  "targetHandle": "node-1-input-1"
}
```

Branch outputs follow their own naming. A `conditions` block gives each condition an output named by `data.conditions[outputIndex].id`; the last output (index ≥ 2) of `conditions`, `BlockBasicWithFallback`, and `BlockBasic` carries the name `fallback`.

Example — a condition branch edge, where `<conditionId>` is the id of the matching `data.conditions` entry.

```json
{
  "source": "condNode1",
  "sourceHandle": "condNode1-output-<conditionId>",
  "target": "thenNode",
  "targetHandle": "thenNode-input-1",
  "id": "edge-cond-then"
}
```

Example — the fallback output edge.

```json
{
  "source": "condNode1",
  "sourceHandle": "condNode1-output-fallback",
  "target": "elseNode",
  "targetHandle": "elseNode-input-1",
  "id": "edge-cond-else"
}
```

### Execution semantics

The engine starts the run at the trigger block's node. Each block handler returns the next block id, or an array of block ids — an array spawns parallel workers, one per next block. The engine does not store incoming edges; it computes outgoing connections per output index via `getBlockConnections(blockId, outputIndex)` in `src/workflowEngine/WorkflowWorker.js`, which builds `${blockId}-output-${outputIndex}` and looks it up in the connections map.

Per-block error handling lives in `data.onError`: `retry` (with `retryTimes` and `retryInterval`), `toDo: continue | error`, or executing the fallback output.

Example — a per-block `onError` using only the documented option keys.

```json
{
  "data": {
    "onError": "retry",
    "retryTimes": 3,
    "retryInterval": 1000
  }
}
```

## Example — minimal valid workflow

This workflow parses under the schema above: a manual trigger opens a new tab. The `new-tab` data defaults come from the block registry.

```json
{
  "id": "WfAbCdEfGhIj",
  "name": "Minimal example",
  "description": "Trigger, then open a new tab.",
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
          "url": "https://example.com",
          "userAgent": "",
          "active": true,
          "tabZoom": 1,
          "inGroup": false,
          "waitTabLoaded": false,
          "updatePrevTab": false,
          "customUserAgent": false
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
      }
    ],
    "zoom": 1.3
  },
  "table": [],
  "dataColumns": [],
  "trigger": null,
  "createdAt": 1780000000000,
  "updatedAt": 1780000000000,
  "isDisabled": false,
  "settings": {
    "blockDelay": 0,
    "saveLog": true,
    "debugMode": false,
    "execContext": "popup",
    "onError": "stop-workflow"
  },
  "version": "1.29.12",
  "globalData": "{}"
}
```

## Anti-myths

Three mistakes to avoid when reading or writing files:

- **No `model` field.** The format has no `model: "automa-workflow-v1"` discriminator. `version` and `extVersion` carry extension versions, not a schema marker.
- **No top-level `blocks` array.** Blocks live in `drawflow.nodes`. A top-level `blocks` key does not exist; a file with one is not an Automa export.
- **`type` is the component name, not the block id.** `label` names the block (`trigger`, `new-tab`); `type` names the editor Vue component. Swapping them breaks the editor.

Example — the correct pairing of `label` and `type` on a node.

```json
{
  "label": "trigger",
  "type": "BlockBasic"
}
```

