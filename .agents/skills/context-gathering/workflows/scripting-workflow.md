# Workflow: Scripting for Context Gathering

Follow this workflow to create and execute multi-tool JavaScript scripts for context gathering using the `code_mode` environment.

Make sure to perform servers discovery and code mode activation steps in the [Setup workflow](./setup) before following this workflow.

## Rules

- Do NOT use `async` or `await`. All scripts must be synchronous.
- Variables declared in one script execution do not persist to the next. Each `mcp_exec` call runs in a fresh environment.
- Use `globalThis` to access tools having hyphenated names. For example, a tool named `tavily-search` would be accessed as `globalThis["tavily-search"](params)`, while a tool named `search` can be called directly as `search(params)`.

## Errors Handling

- ReferenceError for a tool name indicates the tool is not provided by any server, used to activate `code_mode`. Verify tool names match names returned when activating code mode, and that the correct servers are included in the `servers` list in the `code_mode` call.
- Setup Error handlers on every tool call and processing stage, ensure to exit early, and provide information required to troubleshoot the issue. (if parsing failed, output raw response, and previous steps responses, to understand what was supplied to parsing, and what exactly the error was)
- Perform multiple smaller mcp_exec calls with intermediate outputs if needed, rather than one big script, to simplify debugging and error handling.


## JSON Escaping in mcp-exec Scripts

When writing scripts for `mcp-exec`, the script string is embedded in JSON. This creates two interpreting layers — JSON first, then JavaScript. Careless quoting breaks the JSON layer.

**Golden rules:**
- Use **single quotes** for all JS strings inside the script — double quotes conflict with JSON
- Use **array-join** to build multi-line strings: `['line1', 'line2'].join('\\n')` — JSON-level `\\n` becomes JS newline
- For literal double quotes in the final output content: use `\\\"` triple escaping
- Avoid embedding raw `\n` or `\"` inside the JSON script string — they corrupt JSON parsing

**Common failure symptoms:**
- `JSON Parse error: Unterminated string` — you used `"` inside a JS string and the JSON parser grabbed it
- `Unexpected token ILLEGAL` — the script had `\"` that the JSON parser consumed, breaking JS syntax

**Always wrap every tool call in try/catch** and verify success via return-value checks (e.g., `result.indexOf('written')` for write_memory).

### Broken pattern (raw double quotes in JS strings)

```javascript
var result = write_memory({memory_name: "test", content: "hello world"});
return result;
```

The `"test"` and `"hello world"` strings appear as raw double quotes in JSON, causing `JSON Parse error: Unterminated string`.

### Working pattern (single quotes and array-join)

```javascript
var wm = globalThis['write_memory'];
var content = [
  '# Memory Title',
  '',
  'Body with a `mem:reference` link.',
  '',
  '| Col1 | Col2 |',
  '|------|------|',
  '| Value with \\\"quotes\\\" in output | data |',
].join('\\n');
try {
  var result = wm({memory_name: 'topic/name', content: content});
  return 'OK: ' + result;
} catch(e) {
  return 'ERROR: ' + e.message;
}
```

## Examples

**Scenario**: Defensive scripting with error handling and response validation.

```javascript
const parseJsonWithErrorHandling = (jsonString, toolName) => {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`ERROR parsing JSON response from ${toolName}: ${error.message}. Raw response: ${jsonString}`);
  }
};

const catchToolError = (toolName) => () => (error) => {
  return `ERROR from ${toolName} tool call: ${error.message}`;
};

try {
  const toolResponse = globalThis['hyphen-tool-name']({ query: "my  query" });
} catch (error) {
  return catchToolError('hyphen-tool-name')(error);
}

const parsedResponse = parseJsonWithErrorHandling(toolResponse, 'hyphen-tool-name');

if(!parsedResponse.expectedField) {
  return "ERROR: Expected field 'expectedField' is missing in the tool response. Raw response: " + toolResponse;
}

try {
  const anotherToolResponse = anotherTool(parsedResponse.someField);
} catch (error) {
  return catchToolError('anotherTool')(error);
}

if(!anotherToolResponse) {
  return "ERROR: anotherTool returned an empty response.";
}

const parsedAnotherToolResponse = parseJsonWithErrorHandling(anotherToolResponse, 'anotherTool');

if(parsedAnotherToolResponse.length === 0) {
  return "ERROR: anotherTool returned an empty array response. Raw response: " + anotherToolResponse;
}

const finalShortResult = parsedAnotherToolResponse.filter(item => item.is_active).map(item => item.result);

return finalShortResult;
```

