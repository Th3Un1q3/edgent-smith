# Workflow: Refinement & Discovery
# For tasks with no ready-made recipe.

Follow this workflow to discover context-gathering strategies, identify optimal tool combinations, and build reusable multi-tool scripts for complex requirements.

## Steps

1. **Capability Mapping**
   - Run `mcp_find` with broad keywords to identify potential servers.
   - For each promising server, identify the specific tools available and their input schemas.
   - *Goal*: Create a mental map of what is possible.

2. **Strategy Synthesis (Hypothesis)**
   - Based on the requirements, hypothesize a sequence of tool calls.
   - Identify which tools should be used to fetch raw data, which to process/filter, and which to aggregate.
   - *Goal*: Determine the most efficient path to the desired output.

3. **Empirical Validation (Individual Testing)**
   - Execute tools individually to observe real-world behavior.
   - **Observe**: What is the exact structure of the JSON/string response?
   - **Observe**: Are there common patterns in the errors?
   - **Observe**: How many results are returned?
   - *Goal*: Eliminate guesswork about tool output signatures.

4. **Script Synthesis & Prototyping**
   - Combine the validated tool calls into a single `code_mode` script.
   - Implement logic to:
     - Parse/Extract specific fields from intermediate tool outputs.
     - Handle/Retry on common error patterns.
     - Aggregate results into a final, clean structure.
   - *Goal*: Create a functional, multi-step automated workflow.

5. **Recipe Capture**
   - Once the script works reliably, document the tool combination and the final script, place the recipe under `.agents/skills/context-gathering/recipes/` directory with a descriptive name.
   - Reference the recipe in the skill documentation, and link to it in the task routing table for future reuse.
   - *Goal*: Build a library of proven strategies for complex tasks, reducing future discovery time.
   - This "Refined Recipe" can be used as a template for similar future requests.

## Example Sequence

1. `mcp_find(query: "web")` $\rightarrow$ Identify `tavily`.
2. `mcp_find(query: "docs")` $\rightarrow$ Identify `context7`.
3. **Hypothesis**: Use `context7` to get a Library ID, then `tavily` to search for specific issues within that ID.
4. **Test**: Run `context7` query $\rightarrow$ Note output is a string with "Selected Library ID: XXX".
5. **Test**: Run `tavily` search $\rightarrow$ Note output is a list of objects.
6. **Script**: Write `code_mode` script that parses the string from `context7`, extracts "XXX", then feeds "XXX" into `tavily`.
7. **Capture**: Save the logic for "Multi-source library research".
