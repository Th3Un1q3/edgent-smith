tool: deepwiki ask_question
repo: AutomaApp/automa
question: Show the default data object schema of the attribute-value block including the action, attributeName, attributeValue, findBy, selector fields and any example JSON.
date: 2026-08-12
source: deepwiki

The `attribute-value` block's default data object schema includes fields such as `action`, `attributeName`, `attributeValue`, `findBy`, and `selector`. This schema is defined within the `tasks` object in .

### Data Object Schema
The `attribute-value` block's data schema is as follows:
```json
{
  "disableBlock": false,
  "description": "",
  "findBy": "cssSelector",
  "waitForSelector": false,
  "waitSelectorTimeout": 5000,
  "selector": "",
  "markEl": false,
  "multiple": false,
  "attributeValue": "",
  "attributeName": "",
  "assignVariable": false,
  "variableName": "",
  "dataColumn": "",
  "saveData": true,
  "action": "get",
  "addExtraRow": false,
  "extraRowValue": "",
  "extraRowDataColumn": ""
}
``` 

Here's a breakdown of the requested fields:
*   `action`: This field determines whether to "get" or "set" the attribute value. The default value is `"get"`.  The UI component for this block, `EditAttributeValue.vue`, uses a `ui-select` element to allow users to choose between "get" and "set" actions. 
*   `attributeName`: This string field specifies the name of the attribute to interact with. 
*   `attributeValue`: This string field is used when the `action` is "set", providing the value to set the attribute to.  It is conditionally rendered in the UI based on the `action` field. 
*   `findBy`: This field defines the method used to locate the element, with a default value of `"cssSelector"`. 
*   `selector`: This string field holds the CSS selector or XPath used to identify the target element. 

### Example JSON
An example of the data object for an `attribute-value` block, setting an attribute:
```json
{
  "disableBlock": false,
  "description": "Set data-test-id attribute",
  "findBy": "cssSelector",
  "waitForSelector": false,
  "waitSelectorTimeout": 5000,
  "selector": "#myElement",
  "markEl": false,
  "multiple": false,
  "attributeValue": "new-value",
  "attributeName": "data-test-id",
  "assignVariable": false,
  "variableName": "",
  "dataColumn": "",
  "saveData": true,
  "action": "set",
  "addExtraRow": false,
  "extraRowValue": "",
  "extraRowDataColumn": ""
}
``` 

## Notes
The `refDataKeys` array for the `attribute-value` block indicates which fields support variable references (e.g., `{{variableName}}`). For this block, `selector`, `variableName`, `attributeName`, `extraRowValue`, and `attributeValue` can use variable references.  The `autocomplete` array specifies that `variableName` supports autocomplete functionality. 

Wiki pages you might want to explore:
- [Block System (AutomaApp/automa)](/wiki/AutomaApp/automa#2.2)

View this search on DeepWiki: https://deepwiki.com/search/show-the-default-data-object-s_daaf3428-b9bb-4dfb-a095-2ead6f21fabb
