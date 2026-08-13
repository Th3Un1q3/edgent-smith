# Automa: Select an Element and Attach a Class

Goal: in an Automa workflow, select an element and add a CSS class to it.

## Two blocks to consider

1. Attribute Value block (`attribute-value`) — selects an element and sets any attribute.
2. JavaScript Code block (`javascript-code`) — selects an element and runs arbitrary JS.

## Attribute Value block

- Data schema fields: action (get|set), attributeName, attributeValue, findBy (cssSelector|xpath), selector, waitForSelector, waitSelectorTimeout (5000), markEl, multiple.
- Set a class: action=set, attributeName=class, attributeValue=<className>, findBy=cssSelector, selector=<selector>.
- It calls element.setAttribute(attributeName, attributeValue), which OVERWRITES the entire class attribute — any existing classes are replaced.
- refDataKeys (templating {{}} works on): selector, variableName, attributeName, extraRowValue, attributeValue.
- Needs an active tab first (New Tab or Active Tab block) — web-interaction blocks require it.

## JavaScript Code block

- Runs custom JS in the page context; must call automaNextBlock() or return to continue.
- To ADD a class without removing existing ones, use classList.add: document.querySelector(#el).classList.add(my-class); automaNextBlock();
- This preserves existing classes; the Attribute Value block does not.
- Automa itself uses classList.add internally to tag its injected scripts.

## Recommendation

- Appending a class to an element that already has classes: JavaScript Code block + classList.add().
- Setting/replacing the whole class attribute (or any other attribute): Attribute Value block with action=set.

## Cached sources

- mem:cache/deepwiki/automa/what-is-the-attribute-value-block-how-does-it-get-or-set-an-
- mem:cache/deepwiki/automa/show-the-default-data-object-schema-of-the-attribute-value-b
- mem:cache/deepwiki/automa/when-the-attribute-value-block-sets-the-class-attribute-does