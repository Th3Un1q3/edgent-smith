
// import type { Plugin } from "@opencode-ai/plugin"
// import type { OpencodeClient } from "@opencode-ai/sdk"
// import { log } from "./helpers/logger.ts"
// import { updateState, readState, State, SESSION_FIELDS } from "./helpers/kv-store.ts"
// import { sendMessage } from "./helpers/session-helpers.ts"
// import Bun, { Glob } from "bun"
// import { match } from "./helpers/file-resolver.ts"
// import { applySteeringRules, buildInstructionInjectionRule, buildRequireFirstToolSteeringRule, initCopilotSteeringRules, processRuleOutcomes } from "./helpers/steering-rules.ts"
// import { load } from "js-yaml";

// const PLUGIN_ID = "harness-plugin"

// type InstructionsContextLoaderState = State & {
//   loadedInstructions: Record<string, { injectedAt: string }>;
// }

// import type {
//   SteeringRule,
// } from "./types/steering.ts"

// const extractFrontMatter = (content: string) => {
//   const frontMatterRegex = /^---\n([\s\S]*?)\n---/m;

//   const match = content.match(frontMatterRegex);

//   if (!match) {
//     return { frontMatter: {}, content };
//   }

//   const frontMatterContent = match[1];
//   const frontMatter = load(frontMatterContent) as Record<string, any>;
//   const contentWithoutFrontMatter = content.replace(frontMatterRegex, '').trim();
//   return { frontMatter, content: contentWithoutFrontMatter };

// }

// const DEFAULT_INSTRUCTION_PATTERNS = ["**/*.instructions.md"]

// export const loadCopilotInstructions = async (
//   directory: string,
//   patterns: string[],
//   client: OpencodeClient,
// ) => {
//   await log(client, "info", `[${PLUGIN_ID}] [loadCopilotInstructions] Loading copilot instructions from ${directory}`)

//   const instructions: ParsedCopilotInstruction[] = []

//   for (const pattern of patterns) {
//     const instructionsGlob = new Glob(pattern)

//     for await (const path of instructionsGlob.scan({ cwd: directory, dot: true, absolute: true })) {
//       if (instructions.some(existing => existing.path === path)) {
//         continue
//       }

//       await log(client, "info", `[${PLUGIN_ID}] [loadCopilotInstructions] Loading instruction file: ${path}`)
//       const content = await Bun.file(path).text()

//       const { frontMatter, content: contentWithoutFrontMatter } = extractFrontMatter(content)

//       instructions.push({
//         content: contentWithoutFrontMatter,
//         path,
//         frontMatter,
//       })
//     }
//   }

//   return instructions
// }

// // Loads files matching the configured instruction patterns at startup and conditionally injects their content into sessions when file-path globs match the active tool invocation.

// export const instructionsContextLoader: Plugin = async ({ client, project, directory }) => {
//   const requireExpertToLoadSkills: SteeringRule = buildRequireFirstToolSteeringRule({
//     applyToAgents: ["rug-expert"],
//     requiredFirstTool: "skill",
//     message: ({ input }) => `The tool "${input.tool}" cannot be executed because the required first tool "skill" has not been called in this session. Please call the "skill" tool first before executing "${input.tool}". If you find no relevant skill load "find-skills" and follow it to find and install relevant skills from the marketplace.`
//   })

//   const requireMcpToLoadSkills: SteeringRule = buildRequireFirstToolSteeringRule({
//     applyToAgents: ["rug-mcp"],
//     requiredFirstTool: "skill",
//     message: ({ input }) => `The tool "${input.tool}" cannot be executed because the required first tool "skill" with name "mcp-usage" has not been called in this session. Please call the "skill" tool first before executing "${input.tool}".`
//   })

//   const requireRugToAddTodos = buildRequireFirstToolSteeringRule({
//     applyToAgents: ["rug"],
//     requiredFirstTool: "todowrite",
//     message: `Before calling any other tools and delegation populate detailed decomposition using the "todowrite" tool.`
//   })

//   await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] Initialized.`)

//   const copilotInstructions = await loadCopilotInstructions(directory, DEFAULT_INSTRUCTION_PATTERNS, client)
//   const instructionInjectionRule = buildInstructionInjectionRule({
//     copilotInstructions,
//     fileResolverMatch: match,
//   })

//   const copilotSteeringRules = initCopilotSteeringRules(copilotInstructions)

//   const allSteeringRules: SteeringRule[] = [
//     requireExpertToLoadSkills,
//     requireMcpToLoadSkills,
//     requireRugToAddTodos,
//     instructionInjectionRule,
//     ...copilotSteeringRules,
//   ]

//   const isGlobalInstruction = (instruction: any) => {
//     return !instruction.frontMatter.applyTo || ["**.*", "**"].includes(instruction.frontMatter.applyTo)
//   }

//   const fileBasedInstructions = copilotInstructions.filter(instruction => !isGlobalInstruction(instruction))

//   await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] Loaded ${copilotInstructions.length} copilot instructions, ${fileBasedInstructions.length} are file-based.`)
//   await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] These globs are file-based instructions: ${fileBasedInstructions.map(instruction => instruction.frontMatter.applyTo).join(", ")}`)


//   const dispose = async () => { await log(client, "info", `[${PLUGIN_ID}] [INFO_DISPOSE] Plugin disposed`) }

//   return {
//     "tool.execute.before": async (input, output) => {
//       const outcomes = await applySteeringRules({
//         lifecycle: "tool.execute.before",
//         rules: allSteeringRules,
//         context: { input, output },
//         client,
//         sessionId: input.sessionID,
//       })

//       await processRuleOutcomes({
//         outcomes,
//         client,
//         sessionId: input.sessionID,
//         logPrefix: `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_BEFORE]`,
//       })
//     },

//     "tool.execute.after": async (input, output) => {
//       const { sessionID } = input

//       const outcomes = await applySteeringRules({
//         lifecycle: "tool.execute.after",
//         rules: allSteeringRules,
//         context: { input, output },
//         client,
//         sessionId: sessionID,
//       })

//       for (const outcome of outcomes) {
//         if (outcome.type === "tool_output_enrichment") {
//           output.output = JSON.stringify(outcome.payload)
//         }
//       }

//       await processRuleOutcomes({
//         outcomes,
//         client,
//         sessionId: sessionID,
//         logPrefix: `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER]`,
//       })
//     },

//     "message.send": async (input: any, output: any) => {
//       const sessionID = input.sessionID ?? input.sessionId
//       if (!sessionID) {
//         await log(client, "warn", `[${PLUGIN_ID}] [INFO_MESSAGE_SEND] Skipping steering rules: no session ID available.`)
//         return
//       }

//       const outcomes = await applySteeringRules({
//         lifecycle: "message.send",
//         rules: allSteeringRules,
//         context: { input, output },
//         client,
//         sessionId: sessionID,
//       })

//       const blockToolExecutionOutcomes = outcomes.filter(outcome => outcome.type === "block_tool_execution")

//       if (blockToolExecutionOutcomes.length) {
//         await log(client, "warn", `[${PLUGIN_ID}] [INFO_MESSAGE_SEND] Ignoring block_tool_execution outcome for session ${sessionID}: no tool is executing on message.send.`)
//       }

//       await processRuleOutcomes({
//         outcomes: outcomes.filter(outcome => outcome.type !== "block_tool_execution"),
//         client,
//         sessionId: sessionID,
//         logPrefix: `[${PLUGIN_ID}] [INFO_MESSAGE_SEND]`,
//       })
//     },

//     dispose,
//   }
// }
