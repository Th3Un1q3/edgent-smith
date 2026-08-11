/**
 * AFK enforcer message constant.
 *
 * Defined here rather than in the plugin entry file so that
 * `afk-enforcer.ts` only exports Plugin-typed values. opencode loads plugin
 * root files by directory scan and exporting non-Plugin values from an entry
 * file prevents the plugin from loading. This is guarded from recurring by the
 * `plugin-export-guard/no-non-plugin-export` rule in `eslint.config.js`.
 */

export const AFK_MESSAGE = `<steering priority="warning" reason="user is away from keyboard — permission auto-denied by afk-enforcer plugin" type="instructions">
Permission auto-denied: the user is AFK and cannot approve this request. Do not stall — continue with alternative tools or approaches; stop to report only when fully blocked.

Common failure modes and fixes:
1. Non-canonical bash (\`git -C <dir> status\`, \`git --git-dir ...\`, pipes, \`&&\` chains, heredocs): use the permitted \`git status\`/\`git diff\`/\`git show\`/\`git log\` with no pipes; set the working directory via workdir, not \`-C\` or \`cd ... &&\`.
2. Denied tools (\`curl\`, \`webfetch\`, \`list_mcp_resources\`, unlisted \`gateway_*\`): \`python3 urllib\` for HTTP, the gateway toolchain (\`gateway_mcp-find\`/\`gateway_code-mode\`/\`gateway_mcp-exec\`) for research, \`read_mcp_resource\`/\`list_mcp_resource_templates\` for MCP resources, local \`read\`/\`glob\`/\`grep\` for files.
3. Underlying runners (\`vitest\`, \`bun test\`, \`tsc\`, \`pytest\`): use \`just test\`/\`just lint\`/\`just typecheck\` (or \`uv run\`).
4. Compound commands/heredocs/pipes: one simple command per tool call.
5. Broad kills (\`pkill -f\` can kill the orchestrating session): kill by PID (\`$!\` → \`kill $PID\`, verify with \`kill -0\`).

Never silently skip a denial: report the denied mechanism and keep working with alternatives. If fully blocked, stop and report your progress and the exact blockage.
</steering>`
