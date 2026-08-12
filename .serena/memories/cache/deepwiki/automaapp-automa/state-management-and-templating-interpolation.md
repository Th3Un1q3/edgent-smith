tool: deepwiki ask_question
repo: AutomaApp/automa
question: How is state managed across an Automa workflow run? Explain block data, global data, workflow data, forms and variables. How does a block reference data from a previous block (for example the {{blockData.xxx}} syntax) — what templating or interpolation syntax is used and where is the interpolation code located? Provide file paths.
date: 2026-08-11
source: deepwiki

Automa manages state across workflow runs through the `WorkflowEngine` class, which maintains various data stores like `referenceData` for variables, table data, and global data . Blocks can reference data from previous blocks and other data sources using a templating syntax like `{{blockData.xxx}}`, which is processed by a templating engine, specifically the `renderString` function .

## State Management in Automa Workflows

Automa workflows manage state through several key data structures within the `WorkflowEngine` and `WorkflowWorker` classes.

### Workflow Data
The `WorkflowEngine` class initializes and manages the overall workflow execution . It holds the workflow's `blocks` , `connectionsMap` , and `referenceData` . The `referenceData` object is central to state management, containing:
*   **`variables`**: Stores workflow-specific variables . These can be set and accessed by blocks.
*   **`table`**: Represents the data table associated with the workflow . Blocks can insert or retrieve data from this table.
*   **`secrets`**: Stores sensitive information, loaded from `dbStorage.credentials` .
*   **`loopData`**: Contains data related to loop blocks .
*   **`workflow`**: Stores data from child workflows executed using the "Execute workflow" block .
*   **`googleSheets`**: Holds data related to Google Sheets integration .
*   **`globalData`**: Stores global data accessible across the entire workflow . This data can be initialized from the workflow's `globalData` property or passed in through `options` .

The `WorkflowEngine` also maintains `refDataSnapshots` to track changes in `variables` and `loopData` over time, which is used for logging and debugging .

### Block Data
Each block in a workflow has its own `data` property, which defines its configurable properties and their default values . This `data` is part of the block's metadata defined in `src/utils/shared.js` . When a block is executed, its `data` is passed to its handler function .

### Forms
The "Forms" block (`forms`) is designed to interact with form elements on a webpage . It can get values from form fields or type text into them . The `value` property within the `forms` block's `data` schema can be templated to dynamically input data .

## Data Referencing and Templating

Blocks reference data from previous blocks or other workflow data using a templating syntax, typically `{{blockData.xxx}}`. This interpolation is handled by the `templating` function, which uses `renderString` to process the templates .

### Templating Syntax
The templating syntax allows referencing various data sources:
*   `blockData`: Refers to the data output from a previous block .
*   `variables`: Refers to workflow variables .
*   `globalData`: Refers to global data set for the workflow .
*   `table`: Refers to the workflow's data table .
*   `loopData`: Refers to data from loop blocks .
*   `secrets`: Refers to stored credentials .

For example, in the "AI Workflow" block, input values can be rendered using `renderString` to incorporate dynamic data from `refData` .

### Interpolation Code Location
The core interpolation logic is located in the `renderString` function, which is imported and used by various block handlers. For instance, the `aiWorkflow` handler in `src/workflowEngine/blocksHandler/handlerAiWorkflow.js` uses `renderString` to process input values . Similarly, the `forms` block handler in `src/content/blocksHandler/handlerForms.js` uses `renderString` to interpolate the `value` to be typed into a form field .

The `WorkflowWorker` class prepares the `refData` object, which includes `prevBlockData` and the `WorkflowEngine`'s `referenceData`, before passing it to the `templating` function . The `templating` function then uses this `refData` to resolve the templated values within a block's configuration .

The `javascriptCode` block also provides helper functions like `automaRefData` that allow direct access to workflow data within custom JavaScript code, effectively acting as another form of data referencing .

## Notes
The `autocompleteList` computed property in `src/newtab/pages/workflows/[id].vue`  shows how different data sources like `loopData`, `googleSheets`, `table`, `globalData`, and `variables` are aggregated for autocomplete suggestions in the editor, reflecting the various data points available for templating.

Wiki pages you might want to explore:
- [Block System (AutomaApp/automa)](/wiki/AutomaApp/automa#2.2)
- [JavaScript Code Execution (AutomaApp/automa)](/wiki/AutomaApp/automa#4.2)

View this search on DeepWiki: https://deepwiki.com/search/how-is-state-managed-across-an_72b30af2-4436-49d5-908c-d3321c59b2ec
