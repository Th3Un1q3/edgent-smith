## GitHub Repository Insights

These recipes rely on the [context-gathering skill](../SKILL.md). Load the skill first to interpret these recipes correctly.

### Objective: Perform Q&A query about the repository code/docs/function.

**Servers to Load:** `deepwiki`, `github` (initially), then escalate to `context7` and `tavily` if needed.

**Reference Script**:

```javascript
// Use deepwiki's semantic tools to ask high-level questions about the repository, which can provide insights without needing to manually parse files.
return ask_question({ repoName: "owner/repo", question: "How does this project handle authentication?" });
```

### Reading Repository Issues & Troubleshooting

Investigate unexpected behaviors by combining issue exploration with semantic querying.

**Escalation Path:** `github` (search issues) $\rightarrow$ `deepwiki` (`ask_question`)

#### Workflow: Issue Investigation
1. **Explore**: Use `github` to find relevant issues via title/content search.
2. **Analyze**: Pass issue details into `ask_question` to correlate the problem with codebase semantics and documentation.

#### Example Use Case: Tool Integration Failure
**Problem:** Using `github-mcp-server` through `docker/mcp-gateway` in code mode fails to return file content.

1. **Search**: List issues in `docker/mcp-gateway` containing "github-mcp-server" and "content".
2. **Ask**: 
   ```javascript
   return ask_question({ 
     repoName: "github/github-mcp-server", 
     question: "When accessed via mcp-gateway, what configuration is required to ensure file content retrieval works in code mode?" 
   });
   ```

