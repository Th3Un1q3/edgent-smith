# GitHub Repository Insights

## Overview

| Aspect | Description |
|--------|-------------|
| **Servers** | `deepwiki` — semantic repository Q&A over code/docs; `github` — issue search and repository metadata |
| **When to use** | Exploring a GitHub repository's code, documentation, or issues to understand architecture, find relevant discussions, or troubleshoot unexpected behavior |
| **Combines with** | `store-memories` — persist findings (repo architecture notes, issue analysis) for later reuse |

## Prerequisites

1. Follow [Setup](../workflows/setup.md) — discover servers, activate code-mode
2. Follow [Scripting workflow](../workflows/scripting-workflow.md) — sync JS, error handling, mcp-exec patterns
3. Activate code-mode: `gateway_code-mode({"name": "github-insights", "servers": ["deepwiki", "github"]})`

## Scripts

### Semantic repository Q&A

Ask high-level questions about a repository's code, architecture, or documentation without manually parsing files. `deepwiki`'s `ask_question` returns a plain-text answer derived from the repository's indexed codebase.

```javascript
// Ask a broad architectural question about a repository.
// Tool call pattern: ask_question({ repoName, question })
// Response format: plain text answer string
try {
  var answer = ask_question({
    repoName: "owner/repo",
    question: "How does this project handle authentication?"
  });
  return answer;
} catch (e) {
  return "ERROR: " + e.message;
}
```

```javascript
// Narrower question: focus on a specific module or function.
// Use when the broad question returned too much or too little.
try {
  var answer = ask_question({
    repoName: "owner/repo",
    question: "What is the request validation flow in the API layer?"
  });
  return answer;
} catch (e) {
  return "ERROR: " + e.message;
}
```

### Issue investigation

Combine `github` issue search with `deepwiki` semantic analysis to investigate unexpected behavior. The two-step escalation path gives you broad search results first, then targeted code analysis.

**Step 1 — search issues on GitHub:**

```javascript
// Search for issues matching keywords. The github server returns
// issue titles, URLs, labels, and state (open/closed) for matching items.
// Tool call pattern: github_search_issues({ query, ...filters })
// Response format: JSON with issues array (each has title, url, state, labels)
try {
  var issues = github_search_issues({
    query: "github-mcp-server content retrieval repo:docker/mcp-gateway"
  });
  return issues;
} catch (e) {
  return "ERROR: " + e.message;
}
```

**Step 2 — analyze issues against the codebase with deepwiki:**

After finding relevant issues, pass their context into `ask_question` to correlate the problem with the repository's code and documentation.

```javascript
// Correlate issue findings with codebase semantics.
// Use specific repo, question phrasing that references the problem domain.
try {
  var analysis = ask_question({
    repoName: "github/github-mcp-server",
    question: "When accessed via mcp-gateway, what configuration is required to ensure file content retrieval works in code mode?"
  });
  return analysis;
} catch (e) {
  return "ERROR: " + e.message;
}
```

**Combined script — search issues then analyze the top result:**

Run both steps in sequence when you want to drill into the most relevant issue automatically.

```javascript
// Helper: parse JSON safely without throwing.
function parseJson(str, label) {
  try { return JSON.parse(str); }
  catch (e) { throw new Error("Failed to parse " + label + ": " + e.message); }
}

// Step 1: search issues.
var searchResult;
try {
  searchResult = github_search_issues({
    query: "tool integration failure repo:owner/repo"
  });
} catch (e) {
  return "ERROR searching issues: " + e.message;
}

var parsed;
try { parsed = parseJson(searchResult, "github_search_issues"); }
catch (e) { return "ERROR: " + e.message; }

var issues = parsed.issues || [];
if (issues.length === 0) return "No matching issues found.";

// Take the top issue title as context for deepwiki analysis.
var topIssue = issues[0];
var issueContext = topIssue.title + (topIssue.body ? " — " + topIssue.body.slice(0, 500) : ""); // truncate before return: [truncation-examples.md §A](../references/truncation-examples.md)

// Step 2: analyze against codebase.
try {
  var analysis = ask_question({
    repoName: "owner/repo",
    question: "Based on this issue context, what part of the codebase is responsible? Issue: " + issueContext
  });
  return "Top issue: " + topIssue.url + "\n\nAnalysis:\n" + analysis;
} catch (e) {
  return "Found issue " + topIssue.url + " but analysis failed: " + e.message;
}
```

## Best practices

- **Start broad, then narrow.** Ask a general architectural question first. If the answer is too vague, follow up with a question targeting a specific module or function.
- **Include repo owner in the repo name.** Always use `"owner/repo"` format. `deepwiki` requires the full qualified name (e.g., `"pydantic/pydantic-ai"`, not `"pydantic-ai"`).
- **Use issue search filters to reduce noise.** Narrow by `repo:`, `label:`, `is:issue`, or `is:open` in the query string. The `github` server supports standard GitHub search syntax.
- **Correlate issues with code, not just other issues.** An issue title alone is rarely enough to understand root cause. Always follow issue search with a `deepwiki` query against the relevant repository.
- **Store findings for later reuse.** After completing an investigation, write the key insights (architecture overview, resolved issue patterns) using the `store-memories` recipe. This avoids repeating the same `deepwiki` queries on future tasks.

## Common pitfalls

- `ask_question` may return an answer that references deleted or renamed code. `deepwiki` indexes are not always up to date with the latest commit. Cross-check critical findings against the actual repository files.
- `github_search_issues` returns a JSON **string**, not an object — parse it first with `JSON.parse`. Access the issues array via `parsed.issues`.
- Issue search queries without `repo:` scope search all of GitHub, not just your target repository. Always include `repo:owner/name` in the query to stay scoped.
- `ask_question` does not accept file paths or line numbers — it answers based on its indexed understanding of the whole repository. For file-level questions, use the `codebase-exploration` recipe with `serena` instead.
- All tool calls must be **synchronous** — no `async/await`.
- `deepwiki` may not have indexed private repositories or very new public repos. If `ask_question` returns an empty or generic answer, fall back to `tavily` web search or `context7` for documentation-based research.

## Acceptance criteria

- [ ] `github_search_issues` output parsed with `JSON.parse` before `.issues` is accessed; zero issues returns `"No matching issues found."`.
- [ ] Every `ask_question` call uses full `"owner/repo"` format; its plain-text answer is never `JSON.parse`d.
- [ ] Combined script passes the top issue's title + body snippet (capped at 500 chars — truncation pattern: [truncation-examples.md §A](../references/truncation-examples.md)) as deepwiki context and returns `"Top issue: <url>"` followed by the analysis.
- [ ] Every issue query includes a `repo:owner/name` scope term.
- [ ] All tool calls are synchronous; each is wrapped in try/catch with failures returned as `ERROR: ...` strings (no unhandled exceptions).
