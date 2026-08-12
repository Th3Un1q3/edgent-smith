# Automa Workflow Authoring — Research Foundation (deepwiki)

Source: deepwiki ask_question on AutomaApp/automa, 2026-08-11. Greenfield research (no prior project memory).

## Workflow JSON (.automa)

- NO top-level model or blocks field. Top-level fields: id (nanoid), name, description, icon, folderId, content (null until export), connectedTable, drawflow {nodes, edges, zoom}, table, dataColumns, trigger, createdAt, updatedAt, isDisabled, settings, version, globalData (JSON string).
- version holds the extension version string (browser.runtime.getManifest().version, e.g. 1.29.12). Literal automa-workflow does NOT exist in the codebase (deepwiki search).
- settings object: blockDelay, saveLog, debugMode, execContext, onError.
- Serialization: src/stores/workflow.js (defaultWorkflow + workflowStore CRUD, saveToStorage), src/utils/workflowData.js (convertWorkflow adds extVersion; exportWorkflow JSON blob; importWorkflow deserializes), src/components/newtab/workflow/editor/EditorLocalActions.vue (saveWorkflow -> props.editor.toObject()).

## Block data model + registry

- Registry: tasks object exported from src/utils/shared.js; key = block id (trigger, ai-workflow, ...).
- Definition fields: name, description, icon, component, editComponent, category, inputs, outputs, allowedInputs, maxConnection, refDataKeys, autocomplete, data (default config).
- drawflow node fields (per exported JSON): id (unique numeric node id), label (block id string, e.g. forms), type (component name, e.g. BlockBasic, BlockDelay), position {x, y[, z]}, data (block config).
- i18n: name/description overrides in src/locales/en/blocks.json.

## Categories (tasks registry in src/utils/shared.js)

- general: trigger, ai-workflow, execute-workflow, webhook, blocks-group, clipboard, wait-connections, notification, note, workflow-state, parameter-prompt.
- browser: active-tab, new-tab, switch-tab, new-window, proxy, go-back, forward-page, close-tab, take-screenshot, browser-event, handle-dialog, handle-download, reload-tab, tab-url, cookie.
- interaction: event-click, delay, forms, link, attribute-value, javascript-code, trigger-event, switch-to, upload-file, hover-element, save-assets, press-key, create-element.
- data: insert-data, log-data, delete-data, slice-variable, increase-variable, regex-variable, data-mapping, sort-data.
- conditions: repeat-task, conditions, element-exists, while-loop, loop-data, loop-elements, loop-breakpoint.
- onlineServices: google-sheets, google-sheets-drive, google-drive.
- package: block-package.
- Most common for typical workflows: trigger, new-tab, event-click, forms, javascript-code, insert-data, conditions, loop-data/loop-elements.

## Connections + graph walk

- edges link sourceHandle (output) -> targetHandle (input); WorkflowEngine stores connectionsMap.
- WorkflowWorker.executeBlock -> handler returns result.nextBlockId (single id or array -> parallel WorkflowWorker instances).
- Branch blocks: conditions (dynamic outputs by condition id), webhook (outputs: 2 success/fallback), BlockBasicWithFallback component.
- Error paths: block-level data.onError (retry, toDo continue -> next or fallback connection, toDo error -> custom message); workflow-level settings.onError (keep-running, restart-workflow with maxRestart, else destroy).
- Executor files: src/workflowEngine/WorkflowWorker.js, src/workflowEngine/WorkflowEngine.js, src/utils/convertWorkflowData.js (drawflow -> nodes/edges).

## State + templating

- WorkflowEngine.referenceData: variables, table, secrets, loopData, workflow (child results), googleSheets, globalData; refDataSnapshots track variable/loopData changes for logs.
- Templating syntax {{source.key}}; sources: blockData, variables, globalData, table, loopData, secrets. resolveString/renderString core: src/workflowEngine/templating/renderString.js.
- WorkflowWorker builds refData (prevBlockData + engine.referenceData) and passes to templating before handler runs.
- javascriptCode helpers: automaRefData, automaNextBlock. Editor autocomplete aggregates loopData, googleSheets, table, globalData, variables (src/newtab/pages/workflows/[id].vue).

## Executor + debugging + failure modes

- WorkflowManager.execute -> WorkflowEngine (settings, credentials, variables, trigger detection) -> WorkflowWorker per path; worker destroyed when no next blocks; workflow ends when all workers destroyed.
- Debug: settings.debugMode (attach browser debugger), testingMode breakpoints, addLogHistory per block (status success/error/finish, description, timestamp, replaced values; stored dbStorage.logs), javascriptCode for console.log, blockDelay pause, per-block retries with interval.
- Failure modes: missing block handler (stops workflow), missing trigger block (init fails), nextBlockId pointing to non-existent block (destroy), JS runtime errors caught with $error flag, JS execution timeout, no active tab (no-tab error, message channel closed), aipowerToken missing for ai-workflow, fetchApi log report failures.

## Caveats

- deepwiki elided some file paths mid-sentence (e.g., defaultWorkflow home); paths confirmed elsewhere in answers. drawflow node type=component name (BlockBasic/BlockDelay) per deepwiki — spot-check src/utils/firstWorkflows.js and src/utils/shared.js when building the validator.
- Contradicts user assumption: no model=automa-workflow-v1 field; no top-level blocks array.

## Cached sources

- mem:cache/deepwiki/automaapp-automa/workflow-json-format-model-version-serialization
- mem:cache/deepwiki/automaapp-automa/block-data-model-and-type-registry
- mem:cache/deepwiki/automaapp-automa/block-categories-and-block-types
- mem:cache/deepwiki/automaapp-automa/block-connections-and-executor-graph-walk
- mem:cache/deepwiki/automaapp-automa/state-management-and-templating-interpolation
- mem:cache/deepwiki/automaapp-automa/executor-architecture-debugging-failure-modes
- mem:cache/deepwiki/automaapp-automa/model-field-and-renderstring-location