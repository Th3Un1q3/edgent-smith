tool: deepwiki ask_question
repo: AutomaApp/automa
question: What are the main block categories in Automa (trigger, logic, browser, workflow, etc.) and the concrete block types in each category? List them grouped by category, e.g. category name followed by the block type strings. Which block types are the most commonly used for typical workflows? Provide file paths where these are defined.
date: 2026-08-11
source: deepwiki

Automa organizes its automation blocks into seven main categories, with block definitions centrally managed in the `tasks` object within `src/utils/shared.js` . Each block includes metadata such as its `name`, `description`, `icon`, `component`, `editComponent`, and `category` . The most commonly used block types for typical workflows often involve browser interaction, data manipulation, and conditional logic.

## Block Categories and Types

The block categories and their associated block types are defined in the `tasks` object in `src/utils/shared.js` .

### general
*   `trigger`: The starting point of a workflow .
*   `ai-workflow`: A workflow created by AI-Power .
*   `execute-workflow`: Executes another workflow .
*   `webhook`: Makes an HTTP request .
*   `blocks-group`: Used for grouping blocks .
*   `clipboard`: Gets or sets text from the clipboard .
*   `wait-connections`: Waits for all connections to complete .
*   `notification`: Displays a notification .
*   `note`: An annotation block .
*   `workflow-state`: Manages workflow states .
*   `parameter-prompt`: Prompts for workflow parameters .

### browser
*   `active-tab`: Sets the current tab as active .
*   `new-tab`: Creates a new tab .
*   `switch-tab`: Switches the active tab .
*   `new-window`: Creates a new window .
*   `proxy`: Sets the browser's proxy .
*   `go-back`: Navigates to the previous page .
*   `forward-page`: Navigates to the next page .
*   `close-tab`: Closes a tab or window .
*   `take-screenshot`: Takes a screenshot of the active tab .
*   `browser-event`: Waits for a browser event to be triggered .
*   `handle-dialog`: Accepts or dismisses a JavaScript dialog .
*   `handle-download`: Handles downloaded files .
*   `reload-tab`: Reloads the active tab .
*   `tab-url`: Gets the URL of a tab .
*   `cookie`: Gets, sets, or removes cookies .

### interaction
*   `event-click`: Clicks an element .
*   `delay`: Pauses the workflow for a specified duration .
*   `forms`: Manipulates form elements .
*   `link`: Opens a link element .
*   `attribute-value`: Gets or sets an attribute value of an element .
*   `javascript-code`: Executes custom JavaScript code .
*   `trigger-event`: Triggers an event on an element .
*   `switch-to`: Switches between the main window and an iframe .
*   `upload-file`: Uploads a file to an input element .
*   `hover-element`: Hovers over an element .
*   `save-assets`: Saves assets from an element or URL .
*   `press-key`: Presses a key or a combination of keys .
*   `create-element`: Creates and inserts an element into the page .

### data
*   `insert-data`: Inserts data into a table or variable .
*   `log-data`: Gets the latest log data of a workflow .
*   `delete-data`: Deletes table or variable data .
*   `slice-variable`: Extracts a section of a variable's value .
*   `increase-variable`: Increases the value of a variable .
*   `regex-variable`: Matches a variable value against a regular expression .
*   `data-mapping`: Maps data of a variable or table .
*   `sort-data`: Sorts the items of data .

### conditions
*   `repeat-task`: Repeats a task .
*   `conditions`: A conditional block .
*   `element-exists`: Checks if an element exists .
*   `while-loop`: Executes blocks while a condition is met .
*   `loop-data`: Loops through data .
*   `loop-elements`: Loops through elements .
*   `loop-breakpoint`: Defines where a data loop must stop .

### onlineServices
*   `google-sheets`: Reads Google Sheets data .
*   `google-sheets-drive`: Reads Google Sheets data from Google Drive .
*   `google-drive`: Uploads files to Google Drive .

### package
*   `block-package`: Represents a reusable workflow package .

## Most Commonly Used Block Types

Based on the general nature of workflow automation, the most commonly used block types for typical workflows would likely include:

*   `trigger`: Essential for initiating any workflow .
*   `new-tab`: Frequently used to start browsing or open specific URLs .
*   `event-click`: Fundamental for interacting with web page elements .
*   `forms`: Crucial for inputting data into web forms .
*   `javascript-code`: Provides flexibility for custom logic and advanced interactions .
*   `insert-data`: Important for storing or manipulating data within the workflow .
*   `conditions`: Necessary for creating dynamic and responsive workflows based on various criteria .
*   `loop-data` or `loop-elements`: Used for iterating over collections of data or web elements, which is common in data extraction and repetitive tasks .

## Notes

The block definitions, including their categories and types, are all contained within the `tasks` object in `src/utils/shared.js` . The `Block System` wiki page provides a comprehensive overview of this structure and how blocks are registered and used within Automa . The `name` and `description` fields for each block are often internationalized, with translations found in `src/locales/en/blocks.json` .

Wiki pages you might want to explore:
- [Block System (AutomaApp/automa)](/wiki/AutomaApp/automa#2.2)

View this search on DeepWiki: https://deepwiki.com/search/what-are-the-main-block-catego_41c88242-61a0-4f44-8536-dfac6e7653ad
