tool: deepwiki ask_question
repo: AutomaApp/automa
question: What is the Attribute Value block? How does it get or set an element attribute such as class? Show its options and selector finding mechanism.
date: 2026-08-12
source: deepwiki

The Attribute Value block is an interaction block in Automa that allows you to get or set the value of an HTML element's attribute, such as its `class` or `id`.   It is configured through the `EditAttributeValue` component. 

### Options

The Attribute Value block has the following key options:

*   **Action**: You can choose to either "get" or "set" an attribute's value. 
*   **Attribute Name**: This specifies the name of the attribute you want to interact with (e.g., `class`, `id`, `href`). 
*   **Attribute Value**: If the action is "set", this field defines the new value to assign to the attribute. 
*   **Selector**: This is used to identify the target HTML element. 
*   **Multiple**: If enabled, the block will interact with all elements matching the selector; otherwise, it will only affect the first matching element. 
*   **Assign to variable**: You can store the retrieved attribute value (when action is "get") into a variable. 
*   **Insert to table**: The retrieved attribute value can also be inserted into a data table. 

### Selector Finding Mechanism

The Attribute Value block uses a selector finding mechanism to locate the target element(s) on a webpage. 

1.  **`findBy`**: This property determines whether the selector is a CSS selector or an XPath. 
2.  **`selector`**: This is the actual CSS selector or XPath string used to find the element. 
3.  **`waitForSelector`**: If set to `true`, the block will wait for the element to appear on the page before attempting to interact with it. 
4.  **`waitSelectorTimeout`**: This specifies the maximum time (in milliseconds) to wait for the selector to appear. 

The `handleAttributeValue` function in `src/content/blocksHandler/handlerAttributeValue.js` is responsible for executing the logic of this block.  It utilizes the `handleSelector` utility to find the element(s) based on the provided selector. 

When the action is "set", it uses `element.setAttribute(attributeName, attributeValue)` to change the attribute.  When the action is "get", it retrieves the attribute value using `element.getAttribute(attributeName)`.  Special handling is included for `checked` attributes on checkboxes/radio buttons and `href` attributes on anchor tags. 

## Notes

The `attribute-value` block is categorized under "interaction" blocks.  The `refDataKeys` property indicates that fields like `selector`, `variableName`, `attributeName`, `extraRowValue`, and `attributeValue` can use variable references.  The `autocomplete` property is enabled for `variableName`. 

Wiki pages you might want to explore:
- [Block System (AutomaApp/automa)](/wiki/AutomaApp/automa#2.2)

View this search on DeepWiki: https://deepwiki.com/search/what-is-the-attribute-value-bl_cb37655f-2c4a-4fb9-bf8d-1d849e2440ad
