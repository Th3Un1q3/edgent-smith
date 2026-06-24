import type { Plugin } from "@opencode-ai/plugin"

// Catches and fixes issues and limitations of default OpenCode system.

// TODO: when write tool present - instruct on making concise changes. Max 1 paragraph.
// TODO: catch todos if idle with not all closed push(timeout, loop breaker)
// TODO: when log when tool failed with errors(learn and improve loop)



/**
 * New fixes hueristics:
 * Often glob with no arguments, either go with "*" as fallback.
 * 
 * "reasoning_content": "\nI must provide `pattern`. I'll try to find the files.\n",
      "tool_calls": [
        {
          "id": "262129824",
          "type": "function",
          "function": {
            "name": "glob",
            "arguments": "{}"
          }
        }

* Bash tool appends description into command property, which is not ideal. It should be separate arguments in before call.
        "tool_calls": [
        {
          "id": "614381491",
          "type": "function",
          "function": {
            "name": "bash",
            "arguments": "{\"command\":\"rg \\\"rub-puppet|rug-expert\\\"\\ndescription: Search for rug-generalist or rug-specialist in the codebase.\"}"
          }
        }
      ]
 */

const PLUGIN_ID = "harness-plugin"

const todoContinuationMessage = (todos: Array<{ content: string }>) => `There are incomplete todos:
${todos.map(todo => "[ ] " + todo.content).join("\n")}

Proceed with the following steps:
1. Review the pending todos.
2. Add todos for any missing tasks that need to be completed.
3. Mark completed todos as such.
4. Complete the todos that have no blockers.
5. If any todo requires user input, use the question tool to ask for it.
`

type PluginRuntimeState = {
    sessions: Record<string, any>
}

const TOOL_FIXES = [
    {
        selector: {
            tool_name_in: ["bash"],
        },
        fix: {
            append_description_suffix: "Place description and command to separate arguments. Avoid placing description into the command property."
        }
    },
    {
        selector: {
            tool_name_in: ["grep", "glob"],
        },
        fix: {
            append_description_suffix: "Prefer specific pattern or use wildcard as fallback. Avoid using empty string as pattern. Ensure pattern is present!"
        }
    },
    {
        selector: {
            tool_name_in: ["edit", "read", "bash", "write"],
        },
        fix: {
            append_description_suffix: "Avoid using absolute paths(those starting with '/') until it's unavoidable. The '.' is resolved to the current working directory."
        }
    }
]

const findMatchingToolFixes = (toolName: string) => {
    return TOOL_FIXES.filter(fix => fix.selector.tool_name_in.includes(toolName))
}

type ToolToBeFixed = {
    description: string;
    parameters: Record<string, any>;
}

const applyMatchingToolFixes = (output: ToolToBeFixed, toolFixes: Array<any>) => {
    const initialDescription = output.description || ""
    const descriptionSuffixes = toolFixes.map(fix => fix.fix.append_description_suffix).filter(Boolean)
    return [initialDescription, ...descriptionSuffixes].join("\n")
}


export const harness: Plugin = async ({ project, client, $, directory, worktree }) => {
    const pluginState: PluginRuntimeState = {
        sessions: {}
    }

    const cancelEnforcement = (sessionId: string) => {
        const state = pluginState.sessions[sessionId] || {};

        clearTimeout(state.continuationTimeout)

        pluginState.sessions[sessionId] = {
            ...state,
            lastCancelledAt: new Date(),
        }
    }


    const clearCancellation = (sessionId: string) => {
        const state = pluginState.sessions[sessionId] || {};

        pluginState.sessions[sessionId] = {
            ...state,
            lastCancelledAt: null,
            lastFollowupAt: null,
        }
    }

    const injectMessage = async (sessionId: string, message: string) => {
        const session = await client.session.get({ path: { id: sessionId } }) // ensure session exists

        const state = pluginState.sessions[sessionId] || {};

        if (state.continuationTimeout) {
            clearTimeout(state.continuationTimeout)
        }

        pluginState.sessions[sessionId] = {
            ...state,
            continuationTimeout: setTimeout(async () => {


                const wasCancelledAfterLastContinuation = state.lastCancelledAt && state.lastCancelledAt > state.lastFollowupAt;

                if (wasCancelledAfterLastContinuation) {
                    await client.app.log({
                        body: {
                            service: PLUGIN_ID,
                            level: "info",
                            message: `[${PLUGIN_ID}] Continuation for session ${sessionId} was cancelled after last followup. Skipping injection.`,
                        },
                    })
                    return
                }

                await client.app.log({
                    body: {
                        service: PLUGIN_ID,
                        level: "info",
                        message: `[${PLUGIN_ID}] Injecting follow-up message into session ${sessionId}: ${message}`,
                    },
                })

                pluginState.sessions[sessionId] = {
                    ...pluginState.sessions[sessionId],
                    lastFollowupAt: new Date(),
                    continuationTimeout: null,
                }

                const agent = session.data?.agent || "build"

                await client.session.prompt({
                    path: { id: sessionId },
                    body: {
                        agent,
                        parts: [{
                            type: 'text',
                            text: message
                        }],
                    }
                })
            }, 1000)
        }


    }

    // Log plugin initialization  
    await client.app.log({
        body: {
            service: PLUGIN_ID,
            level: "info",
            message: `[${PLUGIN_ID}] initialized`,
            extra: { directory, project },
        },
    })

    return {
        "tool.execute.before": async (input, output) => {
            if (input.tool === "bash") {
                await client.app.log({
                    body: {
                        service: PLUGIN_ID,
                        level: "debug",
                        message: `[${PLUGIN_ID}] About to execute bash command: ${output.args.command}`,
                    },
                })
            }
        },

        "tool.execute.after": async (input, output) => {
            if (input.tool === "writetodo") {

            }

            if (input.tool === "edit") {
                await client.app.log({
                    body: {
                        service: PLUGIN_ID,
                        level: "debug",
                        message: `[${PLUGIN_ID}] Edit tool executed. Changes made: ${JSON.stringify(output.changes)}`,
                    },
                })
            }
        },

        "chat.message": async (input, output) => {
            const { sessionID } = input;
            clearCancellation(sessionID);
        },

        "tool.definition": async (input, output) => {
            const toolFixes = findMatchingToolFixes(input.toolID);
            output.description = applyMatchingToolFixes(output, toolFixes);
        },

        // Hook: Handle events  
        event: async ({ event }) => {
            if (event.type === "session.error" && event.properties.error?.name == "MessageAbortedError" && event.properties.sessionID) {
                cancelEnforcement(event.properties.sessionID)
            }

            if (event.type === "session.idle") {
                // TODO: run lint + format on idle
                await client.app.log({
                    body: {
                        service: PLUGIN_ID,
                        level: "info",
                        message: `[${PLUGIN_ID}] Session completed`,
                    },
                })

                const todos = await client.session.todo({ path: { id: event.properties.sessionID } });

                const todoCanBeProceedAutomatically = (todo: { status: string }) => ["pending", "in_progress"].includes(todo.status);

                const remainingTodos = todos.data?.filter(todo => todoCanBeProceedAutomatically(todo)) || [];

                const hasTodosToProceed = remainingTodos.length;

                if (hasTodosToProceed) {
                    await injectMessage(event.properties.sessionID, todoContinuationMessage(remainingTodos));
                } else {
                    clearCancellation(event.properties.sessionID);
                }
            }
        },

        // Hook: Inject environment variables  
        "shell.env": async (input, output) => {
            output.env.PROJECT_ROOT = input.cwd
        },
    }
}