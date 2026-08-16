# Automa: block-level onError must be an OBJECT (v1.30.02)

Block-level onError values must be objects: retry {"enable": true, "toDo": "retry", "retryTimes": 2, "retryInterval": 1000} or continue {"enable": true, "toDo": "continue"}. A bare string onError is SILENTLY IGNORED and execution falls through to the workflow-level policy.

Available on: new-tab, javascript-code, close-tab, active-tab, switch-tab, event-click, link, attribute-value. NOT available on: note, delay, webhook, trigger, while-loop, conditions, blocks-group, block-package, element-exists.