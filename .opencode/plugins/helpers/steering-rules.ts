import { log } from "./logger.ts"
import { readState, updateState, type State } from "./kv-store.ts"
import { sendMessage } from "./session-helpers.ts"
import type { ParsedCopilotInstruction, RequireFirstToolFrontMatterConfig } from "../types/instructions.ts"
import type { OpencodeClient } from "@opencode-ai/sdk"
import type {
  SteeringRule,
  SteeringRuleBaseContext,
  SteeringMessageOutcome,
  ToolOutputEnrichmentOutcome,
  BlockToolExecutionOutcome,
  RuleOutcome,
} from "../types/steering.ts"

export const applySteeringRules = async ({
  lifecycle,
  rules,
  context,
  client,
  sessionId,
}: {
  lifecycle: SteeringRule['lifecycle'][number];
  rules: SteeringRule[];
  context: Omit<SteeringRuleBaseContext, 'client' | 'sessionId'>;
  client: OpencodeClient;
  sessionId: string;
}): Promise<RuleOutcome[]> => {
  const outcomes = (await Promise.all(
    rules
      .filter(rule => rule.lifecycle.includes(lifecycle))
      .map(rule => rule.handle({ ...context, client, sessionId }))
  )).flat()
  return outcomes
}

export const processRuleOutcomes = async ({
  outcomes,
  client,
  sessionId,
  logPrefix,
}: {
  outcomes: RuleOutcome[];
  client: OpencodeClient;
  sessionId: string;
  logPrefix: string;
}): Promise<void> => {
  const steeringMessages: string[] = []
  const followUpMessages: string[] = []
  let blockMessage: string | undefined

  for (const outcome of outcomes) {
    if (outcome.type === "tool_output_enrichment") {
      continue
    } else if (outcome.type === "steering_message") {
      steeringMessages.push(outcome.message)
    } else if (outcome.type === "follow_up_message") {
      followUpMessages.push(outcome.message)
    } else if (outcome.type === "block_tool_execution") {
      blockMessage = outcome.message
    }
  }

  if (steeringMessages.length) {
    await log(client, "info", `${logPrefix} Sending steering messages for session ${sessionId} because a steering rule was triggered.`)
    await sendMessage({ client, sessionId, message: steeringMessages.join("\n"), noReply: true })
  }

  if (followUpMessages.length) {
    await log(client, "info", `${logPrefix} Sending follow-up messages for session ${sessionId} because a steering rule was triggered.`)
    await sendMessage({ client, sessionId, message: followUpMessages.join("\n") })
  }

  if (blockMessage) {
    await log(client, "info", `${logPrefix} Blocking tool execution for session ${sessionId} because a steering rule was triggered.`)
    throw new Error(blockMessage)
  }
}

const PLUGIN_ID = "harness-plugin"

const TARGET_TOOLS = ["read", "write", "edit"] as const

type ToolTrackingState = State & {
  loadedInstructions: Record<string, { injectedAt: string }>;
}

type FileResolverMatch = (pattern: string, filePath: string) => boolean

const serializeInstruction = (instruction: ParsedCopilotInstruction): string => {
  return `---\ndescription: ${instruction.frontMatter.description}\npath: ${instruction.path}\napplies_to_files: ${instruction.frontMatter.applyTo}\n---\n${instruction.content}`
}

export const buildInstructionInjectionRule = ({
  copilotInstructions,
  fileResolverMatch,
}: {
  copilotInstructions: ParsedCopilotInstruction[];
  fileResolverMatch: FileResolverMatch;
}): SteeringRule => {
  const nonGlobalInstructions = copilotInstructions.filter((instruction) => {
    const applyTo = instruction.frontMatter.applyTo
    return applyTo && !["**.*", "**"].includes(applyTo)
  })

  return {
    lifecycle: ["tool.execute.after"],
    handle: async (context: SteeringRuleBaseContext) => {
      const { client, sessionId, input, output } = context
      const tool = input.tool as string

      if (!TARGET_TOOLS.includes(tool as any)) {
        return []
      }

      const filePath = input.args?.filePath as string | undefined
      if (!filePath) {
        return []
      }

      await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] Tool: ${tool}, Args: ${JSON.stringify(input.args)}`)

      const matchedInstructions = nonGlobalInstructions.filter((instruction) => {
        return fileResolverMatch(instruction.frontMatter.applyTo as string, filePath)
      })

      if (!matchedInstructions.length) {
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] No relevant instructions found for this tool execution.`)
        return []
      }

      await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] Found ${matchedInstructions.length} relevant instructions for this tool execution.`)

      const relevantInstructions = matchedInstructions.map((instruction) => ({
        description: instruction.frontMatter.description,
        path: instruction.path,
        applies_to_files: instruction.frontMatter.applyTo,
      }))

      const enrichmentOutcome: ToolOutputEnrichmentOutcome = {
        type: "tool_output_enrichment",
        payload: {
          tool_output: output.output as string,
          relevant_instructions: relevantInstructions,
        },
      }

      const shouldSkipCompleteInstructions = tool === "read"
      if (shouldSkipCompleteInstructions) {
        return [enrichmentOutcome]
      }

      const nonInjectedInstructions = readState(sessionId, (state) => {
        const loadedInstructions = (state as ToolTrackingState).loadedInstructions || {}
        return matchedInstructions.filter((instruction) => {
          const injectionStatus = loadedInstructions[instruction.path]
          return !injectionStatus?.injectedAt
        })
      }) as ParsedCopilotInstruction[] | undefined

      if (!nonInjectedInstructions?.length) {
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] All relevant instructions have already been injected for this session.`)
        return [enrichmentOutcome]
      }

      updateState(sessionId, (state) => {
        const current = (state as ToolTrackingState).loadedInstructions || {}
        return {
          ...state,
          loadedInstructions: nonInjectedInstructions.reduce((acc, instruction) => {
            return {
              ...acc,
              [instruction.path]: {
                ...(acc[instruction.path] || {}),
                injectedAt: new Date().toISOString(),
              },
            }
          }, current),
        } as ToolTrackingState
      })

      const instructionsMessage = "<instructions>\n" + matchedInstructions.map(serializeInstruction).join("\n") + "\n</instructions>"

      const steeringOutcome: SteeringMessageOutcome = {
        type: "steering_message",
        message: instructionsMessage,
      }

      return [steeringOutcome, enrichmentOutcome]
    },
  }
}

type ToolCallsState = State & {
  toolCalls: Record<string, string>;
}

export type RequireAgentStartWithToolConfig = {
  requiredFirstTool: string;
  applyToAgents: string[];
  message: string | ((context: SteeringRuleBaseContext) => string);
}

const getCurrentAgent = async (client: OpencodeClient, sessionId: string): Promise<string | undefined> => {
  const currentSession = await client.session.get({ path: { id: sessionId } })
  return (currentSession.data as any)?.agent || 'build'
}

const isAgentOneOf = (targetAgents: string[]) => async (context: SteeringRuleBaseContext): Promise<boolean> => {
  const { client, sessionId } = context;
  const agent = await getCurrentAgent(client, sessionId);
  return targetAgents.includes(agent || '');
}

const DEFAULT_REQUIRE_FIRST_TOOL_MESSAGE = ({
  requiredFirstTool,
}: {
  requiredFirstTool: string;
}) => `The required first tool "${requiredFirstTool}" has not been called in this session. Please call it before using any other tool.`

export const buildRequireFirstToolSteeringRule = ({
  requiredFirstTool,
  applyToAgents,
  message,
}: RequireAgentStartWithToolConfig): SteeringRule => {
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

      const hasCalledRequiredTool = readState<ToolCallsState>(sessionId, (state) => {
        const toolCalls = state.toolCalls || {}
        return !!toolCalls[requiredFirstTool]
      })

      if (hasCalledRequiredTool) {
        return []
      }

      await log(client, "info", `[${PLUGIN_ID}] [requireFirstToolRule] Blocking tool execution for session ${sessionId} because the required first tool "${requiredFirstTool}" has not been called.`)

      const resolvedMessage = typeof message === "function" ? message(context) : message
      const outcome: BlockToolExecutionOutcome = {
        type: "block_tool_execution",
        message: resolvedMessage,
      }
      return [outcome]
    }
  }
}

export const initCopilotSteeringRules = (copilotInstructions: ParsedCopilotInstruction[]): SteeringRule[] => {
  return copilotInstructions.reduce<SteeringRule[]>((rules, instruction) => {
    const config = instruction.frontMatter.requireFirstTool
    if (!config) {
      return rules
    }

    const message = config.message ?? DEFAULT_REQUIRE_FIRST_TOOL_MESSAGE({ requiredFirstTool: config.requiredFirstTool })

    return [
      ...rules,
      buildRequireFirstToolSteeringRule({
        requiredFirstTool: config.requiredFirstTool,
        applyToAgents: config.applyToAgents,
        message,
      }),
    ]
  }, [])
}
