
import type { Plugin } from "@opencode-ai/plugin"
import { OpencodeClient } from "@opencode-ai/sdk"
import { log } from "./helpers/logger.ts"
import { updateState, readState, State, SESSION_FIELDS } from "./helpers/kv-store.ts"
import { sendMessage } from "./helpers/session-helpers.ts"
import Bun, { Glob } from "bun";
import { load } from "js-yaml";

const PLUGIN_ID = "harness-plugin"

type ParsedCopilotInstruction = {
  frontMatter: Record<string, any>;
  content: string;
  path: string;
}

type InstructionsContextLoaderState = State & {
  loadedInstructions: Record<string, { injectedAt: string }>;
}

type ToolTrackingState = State & {
  toolCalls: Record<string, string>;
}

const extractFrontMatter = (content: string) => {
  const frontMatterRegex = /^---\n([\s\S]*?)\n---/m;

  const match = content.match(frontMatterRegex);

  if (!match) {
    return { frontMatter: {}, content };
  }

  const frontMatterContent = match[1];
  const frontMatter = load(frontMatterContent) as Record<string, any>;
  const contentWithoutFrontMatter = content.replace(frontMatterRegex, '').trim();
  return { frontMatter, content: contentWithoutFrontMatter };

}

const loadCopilotInstructions = async (directory, client) => {
  await log(client, "info", `[${PLUGIN_ID}] [loadCopilotInstructions] Loading copilot instructions from ${directory}`)
  // const instructionsGlob = new Glob(".github/instructions/*.instructions.md")
  // TODO-[SIMPLIFY]: EF-01 — Replace hardcoded "**/*.instructions.md" with a configurable pattern list (e.g. `[".github/instructions/*.instructions.md"]).

  const instructionsGlob = new Glob("**/*.instructions.md")

  const instructions: ParsedCopilotInstruction[] = []

  for await (const path of instructionsGlob.scan({ cwd: directory, dot: true, absolute: true })) {

    await log(client, "info", `[${PLUGIN_ID}] [loadCopilotInstructions] Loading instruction file: ${path}`)
    const content = await Bun.file(path).text()

    const { frontMatter, content: contentWithoutFrontMatter } = extractFrontMatter(content)

    instructions.push({
      content: contentWithoutFrontMatter,
      path,
      frontMatter,
    })
  }

  return instructions
}

type SteeringRuleBaseContext = {
  client: OpencodeClient;
  sessionId: string;
  input: any;
  output: any;
}

type FollowUpMessageOutcome = {
  type: "follow_up_message";
  message: string;
}

type BlockToolExecutionOutcome = {
  type: "block_tool_execution";
  message: string;
}



type SteeringMessageOutcome = {
  type: "steering_message";
  message: string;
}

type RuleOutcome = FollowUpMessageOutcome | BlockToolExecutionOutcome | SteeringMessageOutcome

type SteeringRule = {
  lifecycle: Array<"tool.execute.before" | "tool.execute.after" | "message.send">;
  handle: (context: SteeringRuleBaseContext) => Promise<RuleOutcome[]>;
}

const getCurrentAgent = async (client: OpencodeClient, sessionId: string): Promise<string | undefined> => {
  const currentSession = await client.session.get({ path: { id: sessionId } })
  return currentSession.data?.agent || 'build'
}

const isAgentOneOf = (targetAgents: string[]) => async (context: SteeringRuleBaseContext): Promise<boolean> => {
  const { client, sessionId } = context;
  const agent = await getCurrentAgent(client, sessionId);
  return targetAgents.includes(agent || '');
}

type OutcomeBuilder = (context: SteeringRuleBaseContext) => RuleOutcome[]

// Loads **/*.instructions.md files at startup and conditionally injects their content into sessions when file-path globs match the active tool invocation.

const buildRequireFirstToolSteeringRule = ({ applyToAgents, requiredFirstTool, outcomeBuilder }: { applyToAgents: string[], requiredFirstTool: string, outcomeBuilder: OutcomeBuilder }): SteeringRule => {
  return {
    lifecycle: ["tool.execute.before"],
    handle: async (context) => {
      const { input, sessionId, client } = context;
      if (input.tool === requiredFirstTool) {
        return []
      }

      if (!(await isAgentOneOf(applyToAgents)(context))) {
        return []
      }

      const hasCalledSkill = readState<ToolTrackingState>(sessionId, (state) => {
        const toolCalls = state.toolCalls || {}
        return !!toolCalls[requiredFirstTool]
      })

      if (hasCalledSkill) {
        return []
      }

      await log(client, "info", `[${PLUGIN_ID}] [requireToolsRule] Blocking tool execution for session ${sessionId} because the required first tool has not been called.`)

      return outcomeBuilder(context);
    }
  }
}

export const instructionsContextLoader: Plugin = async ({ client, project, directory }) => {
  // TODO: generalize this as rule: RequireAgentStartWithTool(tool_name, agents, message) to enforce that certain tools must be called first before others. This can be used to enforce a "skill" tool to be called before any other tool in the session.)
  const requireExpertToLoadSkills: SteeringRule = buildRequireFirstToolSteeringRule({
    applyToAgents: ["rug-expert"],
    requiredFirstTool: "skill",
    outcomeBuilder: ({ input }) => ([{
      type: "block_tool_execution",
      message: `The tool "${input.tool}" cannot be executed because the required first tool "skill" has not been called in this session. Please call the "skill" tool first before executing "${input.tool}". If you find no relevant skill load "find-skills" and follow it to find and install relevant skills from the marketplace.`
    }])
  })

  const requireMcpToLoadSkills: SteeringRule = buildRequireFirstToolSteeringRule({
    applyToAgents: ["rug-mcp"],
    requiredFirstTool: "skill",
    outcomeBuilder: ({ input }) => ([{
      type: "block_tool_execution",
      message: `The tool "${input.tool}" cannot be executed because the required first tool "skill" with name "mcp-usage" has not been called in this session. Please call the "skill" tool first before executing "${input.tool}".`
    }])
  })

  const requireRugToAddTodos = buildRequireFirstToolSteeringRule({
    applyToAgents: ["rug"],
    requiredFirstTool: "todowrite",
    outcomeBuilder: () => ([{
      type: "block_tool_execution",
      message: `Before calling any other tools and delegation populate detailed decomposition using the "todowrite" tool.`
    }])
  })

  const allSteeringRules: SteeringRule[] = [
    requireExpertToLoadSkills,
    requireMcpToLoadSkills,
    requireRugToAddTodos,
  ]

  await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] Initialized.`)

  // TODO: implement initCopilotSteeringRules to load instructions and transform them into SteeringRules. This will allow for more complex logic than just file path matching, such as checking tool type, user role, or other contextual information.
  const copilotInstructions = await loadCopilotInstructions(directory, client)

  const isGlobalInstruction = (instruction: any) => {
    return !instruction.frontMatter.applyTo || ["**.*", "**"].includes(instruction.frontMatter.applyTo)
  }

  const fileBasedInstructions = copilotInstructions.filter(instruction => !isGlobalInstruction(instruction))

  await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] Loaded ${copilotInstructions.length} copilot instructions, ${fileBasedInstructions.length} are file-based.`)
  await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] These globs are file-based instructions: ${fileBasedInstructions.map(instruction => instruction.frontMatter.applyTo).join(", ")}`)


  const dispose = async () => { await log(client, "info", `[${PLUGIN_ID}] [INFO_DISPOSE] Plugin disposed`) }

  return {
    "tool.execute.before": async (input, output) => {
      // TODO: make applications of these rules generic. Group outputs by outcome type.
      const outcomes: RuleOutcome[] = (await Promise.all(allSteeringRules.filter(rule => rule.lifecycle.includes("tool.execute.before")).map(rule => rule.handle({ client, sessionId: input.sessionID, input, output })))).flat()

      // TODO: resolve first steering messages, then follow-up messages, then block tool execution outcomes.

      const steeringMessageOutcomes = outcomes.filter(outcome => outcome.type === "steering_message")

      if (steeringMessageOutcomes.length) {
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_BEFORE] Sending steering messages for session ${input.sessionID} because a steering rule was triggered.`)
        const steeringMessages = steeringMessageOutcomes.map(outcome => outcome.message).join("\n")
        await sendMessage({
          client,
          sessionId: input.sessionID,
          message: steeringMessages,
          noReply: true,
        })
      }

      const followUpMessageOutcomes = outcomes.filter(outcome => outcome.type === "follow_up_message")

      if (followUpMessageOutcomes.length) {
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_BEFORE] Sending follow-up messages for session ${input.sessionID} because a steering rule was triggered.`)
        const followUpMessages = followUpMessageOutcomes.map(outcome => outcome.message).join("\n")
        await sendMessage({
          client,
          sessionId: input.sessionID,
          message: followUpMessages,
        })
      }

      const blockToolExecutionOutcomes = outcomes.filter(outcome => outcome.type === "block_tool_execution")

      if (blockToolExecutionOutcomes.length) {
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_BEFORE] Blocking tool execution for session ${input.sessionID} because a steering rule was triggered.`)
        const blockMessages = blockToolExecutionOutcomes.map(outcome => outcome.message).join("\n")
        throw new Error(blockMessages)
      }
    },

    "tool.execute.after": async (input, output) => {
      // TODO: apply all steering rules to the tool execution context and inject any relevant instructions into the session. This will allow for more complex logic than just file path matching, such as checking tool type, user role, or other contextual information.

      const { tool, sessionID, callID, args } = input
      if (['read', 'write', 'edit'].includes(tool)) {
        // Tool: read, Args: {\"filePath\":\"/workspace/agents/edge.py\"}"
        // [instructions-context-loader] [INFO_TOOL_EXECUTE_AFTER] Tool: edit, Args: {\"filePath\":\"/workspace/agents/edge.py\",\"oldString\":\"_SYSTEM = \\\"\\\"\\\"\\\\\\nYou are a precise, efficient assistant designed for edge deployment on constrained hardware.\\n- Use tools only when necessary and cite any external sources used.\\n\\\"\\\"\\\"\",\"newString\":\"_SYSTEM = \\\"\\\"\\\"\\\\\\nYou are a precise, efficient assistant designed for edge deployment on constrained hardware.\\n- Use tools only when necessary and cite any external sources used.\\n- Be friendly and concise.\\n\\\"\\\"\\\"\"}"
        // harness-plugin] [instructions-context-loader] [INFO_TOOL_EXECUTE_AFTER] Tool: write, Args: {\"filePath\":\"/workspace/.opencode/sample.txt\",\"content\":\"sample content\\n\"}"
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] Tool: ${tool}, Args: ${JSON.stringify(args)}`)

        const matchedInstructions = fileBasedInstructions.filter(instruction => {
          const applyTo = instruction.frontMatter.applyTo
          // TODO-[EXTENDABLE]: EF-03 — When a FileResolver abstraction is introduced, use `fileResolver.match(applyTo, args.filePath)` instead of new Glob().match() here.

          const instructionGlob = new Glob(applyTo)
          return instructionGlob.match(args.filePath)
        })

        if (!matchedInstructions.length) {
          await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] No relevant instructions found for this tool execution.`)
          return
        }

        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] Found ${matchedInstructions.length} relevant instructions for this tool execution.`)

        // TODO: This is soft - minimal injection rework it to be tool_output_enrichment outcome
        const relevantInstructionsReferences = matchedInstructions.map(instruction => {
          return {
            description: instruction.frontMatter.description,
            path: instruction.path,
            applies_to_files: instruction.frontMatter.applyTo,
          }
        })

        output.output = JSON.stringify({
          tool_output: output.output,
          relevant_instructions: relevantInstructionsReferences,
        })

        // Some tools require complete instructions to be injected, some only the output
        const shouldSkipCompleteInstructions = tool === 'read'
        if (shouldSkipCompleteInstructions) {
          return
        }

        // TODO: Rework this logic into a steering rule
        const nonInjectedInstructions = readState(sessionID, (state) => {
          const loadedInstructions = state.loadedInstructions as Record<string, { injectedAt: string }> || {}
          return matchedInstructions.filter(instruction => {
            const injectionStatus = loadedInstructions[instruction.path]
            return !injectionStatus?.injectedAt
          })
        }) as ParsedCopilotInstruction[]

        if (!nonInjectedInstructions.length) {
          await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] All relevant instructions have already been injected for this session.`)
          return
        }

        // Prevents sending if already sent in this session
        await updateState(sessionID, (state) => {
          return {
            ...state,
            loadedInstructions: nonInjectedInstructions.reduce((acc, instruction) => {
              const injectionStatus = acc[instruction.path] || { injectedAt: false }
              return {
                ...acc,
                [instruction.path]: {
                  ...injectionStatus,
                  injectedAt: new Date().toISOString(),
                }
              }
            }, state.loadedInstructions as InstructionsContextLoaderState['loadedInstructions'] || {}),
          }
        })

        const serializedInstructions = (instruction: ParsedCopilotInstruction) => `---\ndescription: ${instruction.frontMatter.description}\npath: ${instruction.path}\napplies_to_files: ${instruction.frontMatter.applyTo}\n---\n${instruction.content}`

        const instructions = "<instructions>\n" + matchedInstructions.map(serializedInstructions).join("\n") + "\n</instructions>"

        await sendMessage({
          client,
          sessionId: sessionID,
          message: instructions,
          noReply: true,
        })
      }
    },
    dispose,
  }
}
