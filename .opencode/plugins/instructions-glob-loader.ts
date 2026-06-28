
import type { Plugin } from "@opencode-ai/plugin"
import { OpencodeClient } from "@opencode-ai/sdk"
import { log } from "./helpers/logger.ts"
import { updateState, readState, State } from "./helpers/kv-store.ts"
import { sendMessage } from "./helpers/session-helpers.ts"
import Bun, { Glob } from "bun";
import { load } from "js-yaml";

const PLUGIN_ID = "instructions-context-loader"

type ParsedCopilotInstruction = {
  frontMatter: Record<string, any>;
  content: string;
  path: string;
}

type InstructionsContextLoaderState = State & {
  loadedInstructions: Record<string, { injectedAt: string }>;
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

// Loads **/*.instructions.md files at startup and conditionally injects their content into sessions when file-path globs match the active tool invocation.
export const instructionsContextLoader: Plugin = async ({ client, project, directory }) => {
  await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] Initialized.`)

  const copilotInstructions = await loadCopilotInstructions(directory, client)

  const isGlobalInstruction = (instruction: any) => {
    return !instruction.frontMatter.applyTo || ["**.*", "**"].includes(instruction.frontMatter.applyTo)
  }

  const fileBasedInstructions = copilotInstructions.filter(instruction => !isGlobalInstruction(instruction))

  await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] Loaded ${copilotInstructions.length} copilot instructions, ${fileBasedInstructions.length} are file-based.`)
  await log(client, "info", `[${PLUGIN_ID}] [INFO_INIT] These globs are file-based instructions: ${fileBasedInstructions.map(instruction => instruction.frontMatter.applyTo).join(", ")}`)


  const dispose = async () => { await log(client, "info", `[${PLUGIN_ID}] [INFO_DISPOSE] Plugin disposed`) }

  return {
    "tool.execute.before": async (input, output) => { },
    "tool.execute.after": async (input, output) => {
      const { tool, sessionID, callID, args } = input

      if (['read', 'write', 'edit'].includes(tool)) {
        // Tool: read, Args: {\"filePath\":\"/workspace/agents/edge.py\"}"
        // [instructions-context-loader] [INFO_TOOL_EXECUTE_AFTER] Tool: edit, Args: {\"filePath\":\"/workspace/agents/edge.py\",\"oldString\":\"_SYSTEM = \\\"\\\"\\\"\\\\\\nYou are a precise, efficient assistant designed for edge deployment on constrained hardware.\\n- Use tools only when necessary and cite any external sources used.\\n\\\"\\\"\\\"\",\"newString\":\"_SYSTEM = \\\"\\\"\\\"\\\\\\nYou are a precise, efficient assistant designed for edge deployment on constrained hardware.\\n- Use tools only when necessary and cite any external sources used.\\n- Be friendly and concise.\\n\\\"\\\"\\\"\"}"
        // harness-plugin] [instructions-context-loader] [INFO_TOOL_EXECUTE_AFTER] Tool: write, Args: {\"filePath\":\"/workspace/.opencode/sample.txt\",\"content\":\"sample content\\n\"}"
        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] Tool: ${tool}, Args: ${JSON.stringify(args)}`)

        const matchedInstructions = fileBasedInstructions.filter(instruction => {
          const applyTo = instruction.frontMatter.applyTo
          const instructionGlob = new Glob(applyTo)
          return instructionGlob.match(args.filePath)
        })

        if (!matchedInstructions.length) {
          await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] No relevant instructions found for this tool execution.`)
          return
        }


        await log(client, "info", `[${PLUGIN_ID}] [INFO_TOOL_EXECUTE_AFTER] Found ${matchedInstructions.length} relevant instructions for this tool execution.`)

        // This is soft - minimal injection
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

        if (!shouldSkipCompleteInstructions) {
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

          // Prevent sending if already sent in this session
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
      }
    },
    dispose,
  }
}
