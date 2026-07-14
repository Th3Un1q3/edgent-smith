import { Plugin } from "@opencode-ai/plugin"
import { createIndex } from "./helpers/instruction-indexer"
import { sendMessage } from "./helpers/session-helpers"
import { log } from "./helpers/logger"
import { SessionStorage, State } from "./helpers/kv-store"
import { InstructionContextHelper } from "./helpers/instruction-context-helper"

interface AgentSession extends State {
    agent?: string
}

const PLUGIN_ID = "instructions-loader"

export type StateWithIdempotencyTokens = State & { idempotencyTokens?: Record<string, string> }

export const instructionsLoaderPlugin: Plugin = async ({ client, directory }) => {
    const sessionStorage = new SessionStorage() // TODO: implement dependency injection

    const targetedTools = new Set([
        'edit',
        'write',
        'read'
    ])

    const _helperCache: Record<string, InstructionContextHelper> = {};

    const getHelper = async (sessionID: string) => {
        const session = await client.session.get({ path: { id: sessionID } })
        const agent = ((session?.data as AgentSession)?.agent) || "build"

        if (Object.hasOwn(_helperCache, agent)) return _helperCache[agent]

        // Create helper with factory that returns indexer's forFiles + loadBody
        const index = await createIndex({ agent, instructionsGlob: ".opencode/instructions/*.instructions.md", currentWorkingDirectory: directory, type: "custom", log: (message) => log(client, "info", `[${PLUGIN_ID}] ${message}`) })

        const helper = new InstructionContextHelper({
            indexerFactory: () => Promise.resolve({
                forFiles: index.forFiles.bind(index),
                loadBody: index.loadBody.bind(index),
            }),
            maxChars: 8192,
            blockOverheadChars: 200,
        })

        _helperCache[agent] = helper
        return helper
    }

    return {
        "tool.execute.before": async (input, output) => {
            if (!targetedTools.has(input.tool) || !input.sessionID || !output.args?.filePath) return

            const helper = await getHelper(input.sessionID)
            const instructions = await helper.resolveInstructions([output.args.filePath])

            const instructionsWithTokens = instructions.map(instructionMeta => ({
                ...instructionMeta,
                idempotencyToken: `instruction_load:${instructionMeta.path}`
            }));

            const idempotencyTokens = sessionStorage.readState<StateWithIdempotencyTokens, Record<string, string>>(input.sessionID, (state) => {
                if (!state.idempotencyTokens || Object.keys(state.idempotencyTokens).length === 0) return {}
                return state.idempotencyTokens
            }) ?? {};

            const nonSentInstructions = instructionsWithTokens.filter(instruction => !Object.hasOwn(idempotencyTokens, instruction.idempotencyToken))

            if (nonSentInstructions.length === 0) {
                await log(client, "info", `[${PLUGIN_ID}] No new instructions to send for session ${input.sessionID}.`)
                return
            }

            const formattedBlocks = nonSentInstructions.map(inst => {
                return [
                    `=== INSTRUCTION: ${inst.description} ===`,
                    `Source: ${inst.path}`,
                    "---",
                    "",
                    inst.content ?? "",
                    "",
                    "".padEnd(28, "="),
                ].join("\n")
            }).filter(Boolean).join("\n\n")

            await sendMessage({
                client,
                sessionId: input.sessionID,
                message: `<steering reason="Relevant files touched">\n\n${formattedBlocks}</steering>`,
                noReply: true
            })

            sessionStorage.updateState<StateWithIdempotencyTokens>(input.sessionID, (state) => {
                const existing = state.idempotencyTokens ?? {};
                return {
                    ...state,
                    idempotencyTokens: {
                        ...existing,
                        ...Object.fromEntries(nonSentInstructions.map((instruction) => [instruction.idempotencyToken, new Date().toISOString()])),
                    },
                };
            });
        }
    }
}