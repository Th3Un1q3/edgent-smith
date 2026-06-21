---
description: "Drives exploring of remote documentation"
agent: build
as: remote-docs
return:
 - "/subtask {agent:OpenAgent} Delegate exploration task to the ExternalScout agent $ARGUMENTS, $RESULT[remote-docs]. Collect the results and summarize the findings." 
 - "/subtask {as:analysis} Review $RESULT[exploration]. Identify what's missing and what to explore next. Provide instructions for the next exploration step."
 - "/subtask Review $RESULT[remote-docs] and $RESULT[analysis] Update recipes in `mcp-usage` skill if needed."
---

Load `mcp-usage` skill.

Plan the path on what servers to use to get documentation on the subject.
Create a code-mode sandbox with relevant servers.
Select tools that can be used for the exploration.

Output the list of servers, tools(with interfaces) and the plan for exploration.

## Subject

$ARGUMENTS