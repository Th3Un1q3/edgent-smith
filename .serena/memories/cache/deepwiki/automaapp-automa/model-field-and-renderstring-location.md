tool: deepwiki ask_question
repo: AutomaApp/automa
question: Search the codebase for the literal string automa-workflow. Does an exported .automa file contain a top-level model field with a value like automa-workflow-v1? Also: where is the renderString function defined (file path), and inside a drawflow node of the exported workflow JSON, what do the node fields id, label, type, position, and data contain — specifically what value does the type field hold?
date: 2026-08-11
source: deepwiki

The literal string "automa-workflow" does not appear in the provided codebase. However, an exported `.automa` file does contain a top-level `version` field, which holds the extension's version, such as "1.29.12"  . The `renderString` function is defined in `src/workflowEngine/templating/renderString.js` . Inside a `drawflow` node of the exported workflow JSON, the `id`, `label`, `type`, `position`, and `data` fields are present . Specifically, the `type` field holds a string representing the block component, such as `'BlockBasic'` or `'BlockDelay'`  .

## Exported .automa File Structure

When a workflow is exported, the `exportWorkflow` function in `src/utils/workflowData.js` is responsible for creating the `.automa.json` file . This function calls `convertWorkflow` to structure the workflow data . The `convertWorkflow` function includes a `version` field, which is populated with the current extension version using `browser.runtime.getManifest().version` . This version is a string like "1.29.12" .

The exported workflow JSON also contains a `drawflow` object, which includes `nodes` and `edges` .

## `renderString` Function Definition

The `renderString` function is defined in `src/workflowEngine/templating/renderString.js` . It is imported and used in various block handlers, such as `handlerForms.js`  and `handlerAiWorkflow.js` . For example, in `handlerForms.js`, it's used to render the `data.value` of a text field block before typing it into an element .

## Drawflow Node Fields

Within the `drawflow` object of an exported workflow, each node has the following fields:
*   `id`: A unique identifier for the node .
*   `label`: A descriptive name for the node, often corresponding to the block's function .
*   `type`: This field holds a string representing the component type of the block . Examples from `src/utils/firstWorkflows.js` include `'BlockBasic'`  and `'BlockDelay'` .
*   `position`: An object containing the `x` and `y` coordinates of the node on the canvas, and sometimes a `z` index .
*   `data`: An object containing specific configuration and properties for the block . For instance, a "forms" block might have `description`, `selector`, `type` (e.g., 'text-field'), and `value` fields within its `data` .

## Notes
The search for "automa-workflow" did not yield any direct results in the provided snippets. The closest related concept is the `version` field in the exported workflow, which indicates the extension version, not a specific workflow model version string like "automa-workflow-v1".

Wiki pages you might want to explore:
- [Core Architecture (AutomaApp/automa)](/wiki/AutomaApp/automa#2)

View this search on DeepWiki: https://deepwiki.com/search/search-the-codebase-for-the-li_7b1db065-3c52-4cd6-8b19-8b52007a2410
