import { Plugin } from "@opencode-ai/plugin"
import { createIndex } from "./helpers/instruction-indexer.ts"
import { sendMessage } from "./helpers/session-helpers.ts"
import { log } from "./helpers/logger.ts"
import { SessionStorage, State } from "./helpers/kv-store.ts"

interface AgentSession extends State {
    agent?: string
}

const PLUGIN_ID = "instructions-loader"

type StateWithIdempotencyTokens = State & { idempotencyTokens?: Record<string, string> }

export const instructionsLoaderPlugin: Plugin = async ({ client, directory }) => {
    const sessionStorage = new SessionStorage() // TODO: implement dependency injection

    const targetedTools = [
        'edit',
        'write',
        'read'
    ]

    const _indexCache: Record<string, Awaited<ReturnType<typeof createIndex>>> = {};

    const getIndex = async (sessionID: string) => {
        const session = await client.session.get({ path: { id: sessionID } })
        const agent = ((session?.data as AgentSession)?.agent) || "build"

        if (_indexCache[agent]) return _indexCache[agent]

        const index = await createIndex({ agent, instructionsGlob: ".opencode/instructions/*.instructions.md", currentWorkingDirectory: directory, type: "custom", log: (message) => log(client, "info", `[${PLUGIN_ID}] ${message}`) })
        _indexCache[agent] = index
        return index
    }

    return {
        "tool.execute.before": async (input, output) => {
            if (!targetedTools.includes(input.tool) || !input.sessionID || !output.args?.filePath) return

            const index = await getIndex(input.sessionID)
            const instructions = await index.forFiles([output.args.filePath])

            const instructionsWithTokens = instructions.map(instructionMeta => ({
                ...instructionMeta,
                idempotencyToken: `instruction_load:${instructionMeta.path}`
            }));

            const idempotencyTokens = sessionStorage.readState<StateWithIdempotencyTokens, Record<string, string>>(input.sessionID, (state) => {
                if (!state.idempotencyTokens) return {}
                return state.idempotencyTokens
            });

            const nonSentInstructions = idempotencyTokens ? instructionsWithTokens.filter(instruction => !idempotencyTokens[instruction.idempotencyToken]) : instructionsWithTokens

            if (!nonSentInstructions.length) {
                await log(client, "info", `[${PLUGIN_ID}] No new instructions to send for session ${input.sessionID}.`)
                return
            }

            await sendMessage({
                client,
                sessionId: input.sessionID,
                message: "Consider reviewing the following instructions:\n" + nonSentInstructions.map(instruction => `**Instruction:** ${instruction.description}\n**File:** ${instruction.path}`).join("\n\n"),
                noReply: true
            })

            sessionStorage.updateState<StateWithIdempotencyTokens>(input.sessionID, (state) => {
                const newTokens = nonSentInstructions.reduce((acc, instruction) => ({
                    ...acc,
                    [instruction.idempotencyToken]: new Date().toISOString()
                }), {} as Record<string, string>)
                return { ...state, idempotencyTokens: { ...state.idempotencyTokens, ...newTokens } }
            })
        }
    }
}