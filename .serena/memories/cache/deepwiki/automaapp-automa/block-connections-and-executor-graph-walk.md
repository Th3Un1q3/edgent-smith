tool: deepwiki ask_question
repo: AutomaApp/automa
question: How do blocks connect to each other in Automa (next, true/false branch pointers, incoming/outgoing edges)? How does the workflow executor walk the graph at runtime — does it follow block.next, handle true/false branches, and what happens with a fallback or error path? Provide file paths for the executor code.
date: 2026-08-11
source: deepwiki

In Automa, blocks connect to each other through a system of `output` and `input` connections, which are managed by the `WorkflowEngine` and executed by `WorkflowWorker` instances  . The workflow executor walks the graph by determining the `nextBlockId` based on these connections, handling conditional branches, and providing mechanisms for fallback or error paths  .

## Block Connections

Blocks in Automa are connected using `edges` that link `sourceHandle` (output of a block) to `targetHandle` (input of another block) . The `WorkflowEngine` stores these connections in a `connectionsMap` .

*   **Outgoing Edges**: Each block can have multiple outputs. For example, a "conditions" block or a "BlockBasicWithFallback" block can have a "fallback" output in addition to its regular outputs . The `getBlockConnections` method in `WorkflowWorker` retrieves the connected blocks for a given `blockId` and `outputIndex` .
*   **True/False Branch Pointers**: For conditional blocks like "conditions", specific output names are used to represent different branches. For instance, a "conditions" block's outputs are named based on the condition IDs .

## Workflow Execution

The `WorkflowWorker` is responsible for executing the blocks in a workflow .

### Walking the Graph

1.  **Initial Block Execution**: The execution starts with an `init` method, which calls `executeBlock` for the initial block (usually a trigger block) .
2.  **Determining Next Block**: After a block finishes execution, its handler returns a `result` object that includes `nextBlockId`  . This `nextBlockId` can be a single block ID or an array of block IDs .
3.  **Executing Next Blocks**: The `executeNextBlocks` method is then called with the `nextBlockId` and any `prevBlockData` . If there are multiple next blocks (e.g., from a conditional branch), new `WorkflowWorker` instances are created for parallel execution .

### Handling True/False Branches

Conditional logic is handled within the block's handler, which determines the appropriate `nextBlockId` based on the condition's outcome. For example, a JavaScript Code block can explicitly set the `nextBlockId` using `automaNextBlock` to control the flow .

### Fallback and Error Paths

*   **Block-level Error Handling**: Individual blocks can define an `onError` property in their `data` . If an error occurs, the `WorkflowWorker` checks this property.
    *   If `blockOnError.retry` is enabled, the block can be retried .
    *   If `blockOnError.toDo` is set to `continue`, the workflow proceeds to the next connected blocks (either the default next block or a specific "fallback" connection if defined) .
    *   If `blockOnError.toDo` is `error`, the workflow can throw a custom error message .
*   **Workflow-level Error Handling**: The overall workflow `settings` also include an `onError` option .
    *   If `onError` is `keep-running`, the workflow attempts to continue execution with the next connected blocks .
    *   If `onError` is `restart-workflow`, the workflow can be restarted up to a `maxRestart` limit .
    *   Otherwise, the workflow is destroyed with an error .

### Executor Code Paths

The core executor code is primarily located in:
*   `src/workflowEngine/WorkflowWorker.js`: This file contains the `WorkflowWorker` class, which manages the execution of individual blocks, handles connections, and implements error handling logic .
*   `src/workflowEngine/WorkflowEngine.js`: This file defines the `WorkflowEngine` class, which initializes the workflow, stores block and connection data, and manages `WorkflowWorker` instances  .
*   `src/utils/convertWorkflowData.js`: This utility is responsible for converting the workflow's `drawflow` data into a structured format of `nodes` (blocks) and `edges` (connections) that the engine can use .

## Notes

The `JavaScript Code Execution` wiki page provides a good overview of how JavaScript blocks can influence workflow execution, including controlling the `nextBlockId` and handling data flow . The `handlerJavascriptCode.js` file also shows how `nextBlockId` is determined for JavaScript blocks .

Wiki pages you might want to explore:
- [JavaScript Code Execution (AutomaApp/automa)](/wiki/AutomaApp/automa#4.2)

View this search on DeepWiki: https://deepwiki.com/search/how-do-blocks-connect-to-each_9747634d-de7d-4421-ab49-53385b3b6fe5
