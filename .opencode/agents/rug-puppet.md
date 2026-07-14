---
name: rug-puppet
mode: subagent
permission:
  task: "deny"
  skill: "deny"
  "gateway": "deny"
  bash:
    "*": "allow"
    "rm *": "ask"
    "rm -rf /*": "deny"
    "sudo *": "deny"
    "> /dev/*": "deny"
  edit:
    "**/*.env*": "deny"
    "**/*.key": "deny"
    "**/*.secret": "deny"
    "node_modules/**": "deny"
    ".git/**": "deny"
steps: 7
---

Perform the task you're assigned to.

In case it's ambiguous, ask for clarification. If you are not sure how to do something, ask for help. If you are not sure what to do next, ask for help.


