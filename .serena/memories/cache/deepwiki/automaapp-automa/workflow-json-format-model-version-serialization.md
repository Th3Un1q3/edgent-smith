tool: deepwiki ask_question
repo: AutomaApp/automa
question: What is the exact JSON structure of an Automa workflow file (.automa)? List the top-level fields (model, name, description, blocks, settings, version) and the exact value of the model version string. Which files or classes in the source tree serialize and deserialize the workflow JSON? Provide file paths.
date: 2026-08-11
source: deepwiki

The JSON structure of an Automa workflow file (`.automa`) is defined by the `defaultWorkflow` function in  and further processed by `convertWorkflow` in . The top-level fields include `name`, `description`, `drawflow` (which contains `nodes` and `edges` representing the workflow blocks), `settings`, and `version` . The exact value of the model version string is dynamically retrieved from the browser's runtime manifest, specifically `browser.runtime.getManifest().version` .

## Workflow JSON Structure

The core structure of an Automa workflow is defined by the `defaultWorkflow` function .

Here are the top-level fields:
*   `id`: A unique identifier generated using `nanoid()` .
*   `name`: The name of the workflow .
*   `description`: A description of the workflow .
*   `icon`: An icon associated with the workflow, e.g., 'riGlobalLine' .
*   `folderId`: The ID of the folder the workflow belongs to, or `null` .
*   `content`: This field is initialized as `null` in `defaultWorkflow` . However, when exporting, `convertWorkflow` populates it with various workflow properties, including `extVersion` .
*   `connectedTable`: Initialized as `null` .
*   `drawflow`: Represents the visual graph structure of the workflow, containing `edges` and `nodes` .
    *   `nodes`: An array of objects, each representing a block in the workflow, including its `position`, `id`, `label`, `data`, and `type` .
    *   `edges`: An array of objects representing connections between nodes .
    *   `zoom`: The zoom level of the workflow editor .
*   `table`: An array representing data schema .
*   `dataColumns`: An array for data columns .
*   `trigger`: The trigger configuration for the workflow .
*   `createdAt`: Timestamp of workflow creation .
*   `updatedAt`: Timestamp of last workflow update .
*   `isDisabled`: A boolean indicating if the workflow is disabled .
*   `settings`: An object containing various workflow settings such as `blockDelay`, `saveLog`, `debugMode`, `execContext`, and `onError` .
*   `version`: The version of the Automa extension that created or last modified the workflow .
*   `globalData`: A JSON string for global data .

The exact value of the model version string is obtained from `browser.runtime.getManifest().version` .

## Serialization and Deserialization

The primary files involved in serializing and deserializing workflow JSON are:

*   **`src/stores/workflow.js`**: This file contains the `defaultWorkflow` function, which defines the initial structure of a workflow object . The `workflowStore` in this file handles CRUD operations for workflows, including loading data from `browser.storage.local` and saving it . When a workflow is updated, the `saveToStorage` action is called to persist the changes .
*   **`src/utils/workflowData.js`**: This file contains the `convertWorkflow` function, which prepares a workflow object for export by selecting specific keys and adding `extVersion` . The `exportWorkflow` function in this file serializes the workflow object (and any included workflows) into a JSON string and creates a Blob for download . The `importWorkflow` function (though not fully shown in the provided context) would handle deserialization.
*   **`src/components/newtab/workflow/editor/EditorLocalActions.vue`**: The `saveWorkflow` function in this component is responsible for taking the current state of the workflow editor (nodes and edges) and updating the workflow in the `workflowStore` . It calls `props.editor.toObject()` to get the workflow's `drawflow` data, which is then passed to `workflowStore.update` .

## Notes

The `blocks` field mentioned in the prompt is not a top-level field in the workflow JSON structure. Instead, the workflow's blocks are represented within the `drawflow.nodes` array . The `model` field is also not a direct top-level field; the workflow structure itself serves as the model. The `version` field directly stores the extension's version string .

Wiki pages you might want to explore:
- [Core Architecture (AutomaApp/automa)](/wiki/AutomaApp/automa#2)

View this search on DeepWiki: https://deepwiki.com/search/what-is-the-exact-json-structu_b140a9ca-c3ab-4a28-adb5-d16eae0cc460
