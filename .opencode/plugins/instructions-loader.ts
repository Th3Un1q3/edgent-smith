/**
 * instructions-loader — OpenCode v2 Effect plugin (migrated).
 *
 * Native `Plugin` type is imported TYPE-ONLY: `tsc` verifies against the real
 * API, while the runtime never evaluates `@opencode/plugin`'s schema modules.
 */
import { Effect } from 'effect'
import type { Plugin } from '@opencode/plugin/effect/plugin'
import { createIndex } from './helpers/instruction-indexer'
import { InstructionContextHelper } from './helpers/instruction-context-helper'
import type { ResolvedInstruction } from './types/instructions'

const TAG = '[instructions-loader] '
const TARGETED_TOOLS = new Set(['edit', 'write', 'read'])
const FULL_SLOT_BUDGET = 5

const tokenKey = (sessionID: string): string => 'idempotency/' + sessionID
const pendingKey = (sessionID: string): string => 'pending/' + sessionID

const readFilePath = (input: unknown): string | undefined => {
  const arguments_ = input as { path?: unknown, filePath?: unknown } | undefined
  const candidate = arguments_?.path ?? arguments_?.filePath
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

const pickAgent = (fromEvent: unknown, fromSession: unknown): string => {
  const candidate = typeof fromEvent === 'string' && fromEvent.length > 0 ? fromEvent : fromSession
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'build'
}

const formatInstruction = (instruction: ResolvedInstruction, isReference: boolean): string => {
  if (isReference) {
    const meta = instruction.content
      ? ` lines="${instruction.content.split('\n').length}" chars="${instruction.content.length}"`
      : ''
    return [
      '<instruction>',
      `  <description>${instruction.description}</description>`,
      `  <path>${instruction.path}</path>`,
      `  <meta${meta}/>`,
      '</instruction>',
    ].join('\n')
  }
  return [
    '<instruction>',
    `  <description>${instruction.description}</description>`,
    `  <path>${instruction.path}</path>`,
    '  <content>',
    instruction.content ?? '',
    '  </content>',
    '</instruction>',
  ].join('\n')
}

const buildSteeringMessage = (blocks: string): string =>
  `<steering priority="high" reason="relevant files touched" type="instructions">\n${blocks}\n</steering>`

const plugin: Plugin = {
  id: 'opencode.instructions-loader',
  effect: context => Effect.gen(function* () {
    const helpers = new Map<string, InstructionContextHelper>()

    const makeHelper = async (agent: string): Promise<InstructionContextHelper> => {
      const cached = helpers.get(agent)
      if (cached) return cached
      const index = await createIndex({
        agent,
        instructionsGlob: '.opencode/instructions/*.instructions.md',
        currentWorkingDirectory: context.location.directory,
        type: 'custom',
      })
      const helper = new InstructionContextHelper({
        indexerFactory: () => Promise.resolve({
          forFiles: index.forFiles.bind(index),
          loadBody: index.loadBody.bind(index),
        }),
      })
      helpers.set(agent, helper)
      return helper
    }

    yield* Effect.logInfo(TAG + 'loaded', { directory: context.location.directory })

    yield* context.tool.hook('execute.before', event => Effect.gen(function* () {
      const filePath = readFilePath(event.input)
      if (filePath === undefined || !TARGETED_TOOLS.has(event.tool)) return
      const session = yield* context.session.get({ sessionID: event.sessionID })
      const agent = pickAgent(event.agent, (session as { agent?: unknown }).agent)
      const helper = yield* Effect.promise(() => makeHelper(agent))
      const instructions = yield* Effect.promise(() => helper.resolveInstructions([filePath]))
      if (instructions.length === 0) return

      const tokens = ((yield* context.storage.get(tokenKey(event.sessionID))) as Record<string, string> | undefined) ?? {}
      const isAlreadyInjected = (identity: string): boolean => {
        const base = 'instruction_load:' + identity
        return Object.hasOwn(tokens, base) || Object.hasOwn(tokens, `${base}:full`) || Object.hasOwn(tokens, `${base}:ref`)
      }
      const nonSent = instructions.filter((instruction) => {
        const identity = instruction.path ?? instruction.description
        return identity ? !isAlreadyInjected(identity) : true
      })
      if (nonSent.length === 0) return

      const fullCount = Object.keys(tokens).filter(key => key.endsWith(':full')).length
      let slots = Math.max(0, FULL_SLOT_BUDGET - fullCount)
      const flagged = nonSent.map((instruction) => {
        const isReference = slots <= 0
        if (!isReference) slots--
        return { instruction, isReference }
      })

      const blocks = flagged.map(entry => formatInstruction(entry.instruction, entry.isReference)).join('\n\n')
      const message = buildSteeringMessage(blocks)
      yield* context.session.prompt({ sessionID: event.sessionID, text: message, resume: false })
      yield* context.storage.set(pendingKey(event.sessionID), message)

      const recorded = Object.fromEntries(flagged.map(entry => [
        `instruction_load:${entry.instruction.path}:${entry.isReference ? 'ref' : 'full'}`,
        new Date().toISOString(),
      ]))
      yield* context.storage.set(tokenKey(event.sessionID), { ...tokens, ...recorded })
    }).pipe(Effect.orDie))

    yield* context.session.hook('context', event => Effect.gen(function* () {
      const pending = (yield* context.storage.get(pendingKey(event.sessionID))) as string | undefined
      if (!pending) return
      event.system.push({ type: 'text', text: pending })
      yield* context.storage.remove(pendingKey(event.sessionID))
    }))

    yield* Effect.logInfo(TAG + 'registered')
  }),
}

export default plugin
