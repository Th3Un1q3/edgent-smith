tool: deepwiki ask_question
repo: AutomaApp/automa
question: When the attribute-value block sets the class attribute, does it overwrite the existing classes or append to them? Is there a way to add a class to an element without removing existing classes? Does the javascript-code block run classList.add?
date: 2026-08-12
source: deepwiki

When the `attribute-value` block sets the `class` attribute, it overwrites existing classes rather than appending to them . This is because the `setAttribute` method is used, which replaces the entire attribute value .

To add a class to an element without removing existing classes, you would need to use the `javascript-code` block . The `javascript-code` block executes custom JavaScript code , which can include `classList.add()` .

The `javascript-code` block does indeed run `classList.add()` . Specifically, when a script is created and appended to the document, it uses `script.classList.add('automa-custom-js')` to add a class for internal tracking . You can leverage this block to add your own classes using `classList.add()` within the custom code you provide .

## Notes
The `attribute-value` block is designed to either get or set an attribute's value directly . Its `action` property determines whether it `get`s or `set`s the attribute . When `action` is set to `'set'`, it uses `element.setAttribute(attributeName, attributeValue)` . This method replaces the entire value of the specified attribute.

In contrast, the `javascript-code` block allows for arbitrary JavaScript execution . This means you can write code like `element.classList.add('your-new-class')` within the block's `code` property , which will append the class without affecting existing ones.

Wiki pages you might want to explore:
- [Automa Overview (AutomaApp/automa)](/wiki/AutomaApp/automa#1)

View this search on DeepWiki: https://deepwiki.com/search/when-the-attributevalue-block_253fe155-2e1d-4663-a2cf-c25b468efdb6
