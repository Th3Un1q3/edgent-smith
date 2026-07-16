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
        })

        _helperCache[agent] = helper
        return helper
    }

    return {
        "tool.execute.before": async (input, output) => {
            if (!targetedTools.has(input.tool) || !input.sessionID || !output.args?.filePath) return

            const helper = await getHelper(input.sessionID)
            const instructions = await helper.resolveInstructions([output.args.filePath])

            // Read session state for existing tokens (now with :full/:ref suffixes)
            const idempotencyTokens = sessionStorage.readState<StateWithIdempotencyTokens, Record<string, string>>(input.sessionID, (state) => {
                if (!state.idempotencyTokens || Object.keys(state.idempotencyTokens).length === 0) return {}
                return state.idempotencyTokens
            }) ?? {};

            // Count remaining full-content slots — only :full suffix consumes budget
            const fullCount = Object.keys(idempotencyTokens).filter(k => k.endsWith(":full")).length
            const remainingSlots = Math.max(0, 5 - fullCount)

            // Idempotency check handles all three token formats: base key, :full, and :ref
            const isAlreadyInjected = (path: string) => {
                const baseKey = `instruction_load:${path}`
                return Object.hasOwn(idempotencyTokens, baseKey) ||
                       Object.hasOwn(idempotencyTokens, `${baseKey}:full`) ||
                       Object.hasOwn(idempotencyTokens, `${baseKey}:ref`)
            }

            // path is always set by resolveInstructions() but typed as optional in ResolvedInstruction
            const nonSentInstructions = instructions.filter(instruction => {
                const safePath = instruction.path ?? instruction.description;
                if (!safePath) return true; // skip if neither path nor description exists
                return !isAlreadyInjected(safePath);
            })

            if (nonSentInstructions.length === 0) {
                await log(client, "info", `[${PLUGIN_ID}] No new instructions to send for session ${input.sessionID}.`)
                return
            }

            // Separate full vs reference based on remaining slots
            let slotsRemaining = remainingSlots
            const instructionsWithFlag = nonSentInstructions.map((inst) => {
                const isReference = slotsRemaining <= 0
                if (!isReference) slotsRemaining--
                return { ...inst, isReference }
            })

            // Formatter: reference-only injections have empty body (description + path only)
            const formattedBlocks = instructionsWithFlag.map(inst => {
                if (inst.isReference) {
                    return [
                        `=== INSTRUCTION: ${inst.description} ===`,
                        `Source: ${inst.path}`,
                        "---",
                        "",
                        "",
                        "".padEnd(28, "="),
                    ].join("\n")
                }
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

            // Record tokens with appropriate suffixes
            const newTokens = Object.fromEntries(
                instructionsWithFlag.map(inst => [
                    `instruction_load:${inst.path}:${inst.isReference ? 'ref' : 'full'}`,
                    new Date().toISOString()
                ])
            )

            sessionStorage.updateState<StateWithIdempotencyTokens>(input.sessionID, (state) => {
                const existing = state.idempotencyTokens ?? {};
                return {
                    ...state,
                    idempotencyTokens: {
                        ...existing,
                        ...newTokens,
                    },
                };
            });
        }
    }
}