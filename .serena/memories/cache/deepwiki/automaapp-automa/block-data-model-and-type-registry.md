tool: deepwiki ask_question
repo: AutomaApp/automa
question: How are blocks defined in the code? What is the block data model — its fields such as id, label, type, category, position (x,y), next, and true/false branch connections? Where in the source tree is the block type registry or block definitions located? Provide file paths.
date: 2026-08-11
source: deepwiki

Blocks in the Automa codebase are defined within a centralized registry, the `tasks` object, exported from `src/utils/shared.js` . This object acts as the master registry, mapping block IDs to their complete metadata definitions .

## Block Data Model

The block data model includes several fields that define its appearance, behavior, and configuration options . While `id` and `label` are derived or translated, the core definition includes fields such as `name`, `description`, `icon`, `component`, `editComponent`, `category`, `inputs`, `outputs`, `allowedInputs`, `maxConnection`, `refDataKeys`, `autocomplete`, and `data` .

Here's a breakdown of the fields you mentioned and their corresponding representation in the block data model:

*   **id**: This is the key used in the `tasks` object to identify each block, for example, `'trigger'` or `'ai-workflow'`  .
*   **label**: The display name of the block is provided by the `name` field, which can be overridden by internationalization (i18n) .
*   **type**: There isn't a direct `type` field at the top level of the block definition. Instead, the `data` object within each block often contains a `type` field specific to that block's functionality, such as `type: 'manual'` for the `trigger` block .
*   **category**: The `category` field groups blocks into functional categories like `'general'`, `'browser'`, `'interaction'`, `'data'`, `'conditions'`, `'onlineServices'`, and `'package'` .
*   **position (x,y)**: The block definitions themselves do not store position data. This information is likely managed by the workflow editor component that renders the blocks.
*   **next, and true/false branch connections**: These are represented by the `inputs` and `outputs` fields .
    *   `inputs`: Defines the number of input connection points .
    *   `outputs`: Defines the number of output connection points .
    *   `maxConnection`: Specifies the maximum number of outgoing connections .
    *   Blocks like `conditions`  and `webhook`  can have multiple outputs to represent different branches (e.g., success/failure or conditional paths). For example, the `conditions` block has `outputs: 0` but dynamically creates outputs based on its `conditions` data  . The `webhook` block has `outputs: 2` for success and fallback paths .

Each block also contains a `data` object, which holds the default data schema for the block's configurable properties . This `data` object can include fields like `disableBlock`, `description`, and other block-specific properties .

## Block Type Registry Location

The block type registry and all block definitions are located in `src/utils/shared.js` . This file exports a constant object named `tasks` which contains the definitions for all available blocks .

For example, the `trigger` block is defined starting at line 2 , the `ai-workflow` block at line 52 , and so on   .

## Notes

The `Block System` wiki page provides a comprehensive overview of how blocks are structured and managed within the Automa application. It highlights that the `tasks` object in `src/utils/shared.js` is the central registry for all block metadata . The wiki also details the `Block Metadata Schema`, which outlines the various fields present in each block definition . While the prompt asks about `id` and `label`, these are often derived or translated from the `name` field and the key in the `tasks` object, respectively . The concepts of `next` and `true/false branch connections` are handled by the `inputs`, `outputs`, and `maxConnection` fields, with specific block components like `BlockConditions` and `BlockBasicWithFallback` designed to visually represent these branching paths   . Position data for blocks is not part of their definition in `shared.js` but would be handled by the visual editor.

Wiki pages you might want to explore:
- [Block System (AutomaApp/automa)](/wiki/AutomaApp/automa#2.2)

View this search on DeepWiki: https://deepwiki.com/search/how-are-blocks-defined-in-the_254d795b-d093-4f2a-a497-03bdb7f971a1
