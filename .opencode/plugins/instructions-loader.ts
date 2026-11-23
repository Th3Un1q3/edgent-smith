/**
 * instructions-loader — OpenCode v2 Effect plugin (migrated).
 *
 * Native `Plugin` type is imported TYPE-ONLY: `tsc` verifies against the real
 * API, while the runtime never evaluates `@opencode/plugin`'s schema modules.
 *
 * Native delivery is one turn deferred: a published entry becomes visible at the
 * next request boundary, never within the touch that wrote it.
 */
import { readdirSync } from 'node:fs'

import path from 'node:path'

import { Effect } from 'effect'
import type { Plugin } from '@opencode/plugin/effect/plugin'
import { createIndex } from './instructions/indexer'
import { InstructionContextHelper } from './instructions/context-helper'
import { MAX_ENTRY_VALUE_BYTES, entryValueBytes } from './helpers/instructions/entry-client'
import { resolveInjectionCarrier } from './instructions/carrier'
import { namespacedStore } from './helpers/runtime/namespaced-store'
import { readFilePath } from './helpers/runtime/tool-input'
import { appendSynthetic } from './helpers/session/synthetic-append'
import { createSessionReader } from './helpers/session/read'
import { TAG } from './instructions/diagnostics'
import { FULL_BODY_BUDGET } from './instructions/native-plan'
import { attemptNative } from './instructions/native-attempt'
import { seededKey, seedFallbackExclusions, seedSyntheticExclusions } from './instructions/seeding'
import { buildSteeringMessage, formatInstruction } from './helpers/instructions/payload'

const TARGETED_TOOLS = new Set(['edit', 'write', 'read'])

const TOKEN_PREFIX = 'idempotency/'

const isTokenRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const decodeTokens = (value: unknown): Record<string, string> | undefined =>
  isTokenRecord(value) ? value : undefined

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0

const pickAgent = (fromEvent: unknown, fromSession: unknown): string => {
  if (isNonEmptyString(fromEvent)) return fromEvent
  return isNonEmptyString(fromSession) ? fromSession : 'build'
}

const isTargetedFile = (filePath: string | undefined, tool: string): filePath is string =>
  filePath !== undefined && TARGETED_TOOLS.has(tool)

// The cached index outlives a deleted file. allPaths records every glob match
// before the agent filters, so comparing basenames cannot force a rebuild for a
// file that only a different agent indexes.
const isHelperStale = (helper: InstructionContextHelper, directory: string): boolean => {
  let fresh: string[] = []
  try {
    fresh = readdirSync(path.join(directory, '.opencode', 'instructions'), { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.instructions.md'))
      .map(entry => entry.name)
  }
  catch {
    // A missing or unreadable directory has no fresh instruction files.
  }
  const indexed = [...new Set(helper.allPaths.map(filePath => path.basename(filePath)))]
    .filter(name => name.endsWith('.instructions.md'))
  return indexed.sort((a, b) => a.localeCompare(b)).join('\n') !== fresh.sort((a, b) => a.localeCompare(b)).join('\n')
}

const plugin: Plugin = {
  id: 'opencode.instructions-loader',
  effect: context => Effect.gen(function* () {
    const helpers = new Map<string, InstructionContextHelper>()
    const tokenStore = namespacedStore(context.storage, TOKEN_PREFIX, decodeTokens)
    const sessionReader = createSessionReader(context)

    const makeHelper = async (agent: string): Promise<InstructionContextHelper> => {
      const cached = helpers.get(agent)
      if (cached !== undefined && !isHelperStale(cached, context.location.directory)) return cached
      helpers.delete(agent)
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
          allPaths: index.allPaths,
        }),
      })
      helpers.set(agent, helper)
      return helper
    }

    yield* Effect.logInfo(TAG + 'loaded', { directory: context.location.directory })

    yield* context.tool.hook('execute.before', event => Effect.gen(function* () {
      const filePath = readFilePath(event.input)
      if (!isTargetedFile(filePath, event.tool)) return
      const identity = yield* sessionReader.read(event.sessionID, 'fresh')
      const agent = pickAgent(event.agent, identity.agent)
      const carrier = resolveInjectionCarrier(process.env, agent)
      yield* Effect.logDebug(`carrier=${carrier} agent=${agent}`)
      const helper = yield* Effect.promise(() => makeHelper(agent))
      const instructions = yield* Effect.promise(() => helper.resolveInstructions([filePath]))

      const runSynthetic = (seeded: ReadonlySet<string>) => Effect.gen(function* () {
        const stored = yield* tokenStore.read(event.sessionID)
        const seededTokens = Object.fromEntries(
          [...seeded].map(identity => [`instruction_load:${identity}`, new Date().toISOString()]),
        )
        const tokens: Record<string, string> = { ...seededTokens, ...stored }
        const persistSeeded = (value: Record<string, string>) =>
          seeded.size > 0 ? tokenStore.write(event.sessionID, value) : Effect.void
        yield* persistSeeded(tokens)
        const isAlreadyInjected = (identity: string): boolean => {
          const base = 'instruction_load:' + identity
          return [base, `${base}:full`, `${base}:ref`].some(key => Object.hasOwn(tokens, key))
        }
        const nonSent = instructions.filter((instruction) => {
          const identity = instruction.path ?? instruction.description
          return identity ? !isAlreadyInjected(identity) : true
        })
        if (nonSent.length === 0) return

        const fullCount = Object.keys(tokens).filter(key => key.endsWith(':full')).length
        let slots = Math.max(0, FULL_BODY_BUDGET - fullCount)
        const flagged = nonSent.map(instruction => ({ instruction, isReference: slots-- <= 0 }))

        // Size guard: full bodies first, then all-`:ref`, then skip the append
        // entirely when even the degraded message exceeds the 256 KiB ceiling.
        const degraded = flagged.map(entry => ({ instruction: entry.instruction, isReference: true }))
        const message = [flagged, degraded]
          .map(entries => buildSteeringMessage(entries.map(entry => formatInstruction(entry.instruction, entry.isReference)).join('\n\n')))
          .find(candidate => entryValueBytes(candidate) <= MAX_ENTRY_VALUE_BYTES)
        if (message === undefined) {
          yield* Effect.logWarning(TAG + 'instruction body exceeds MAX_ENTRY_VALUE_BYTES; skipping append')
          return
        }

        yield* Effect.gen(function* () {
          const firstIdentity = nonSent[0].path ?? nonSent[0].description
          // The id field is omitted: SessionMessage.ID requires a "msg_" prefix (schema
          // check at runtime), so a correlation key cannot be carried there. The runtime
          // generates the id; correlation lives in metadata and idempotency is enforced
          // loader-side by the token map (ADR-022).
          const appended = yield* appendSynthetic(
            context.session.synthetic({
              sessionID: event.sessionID,
              text: message, description: firstIdentity,
              metadata: { instruction_load: firstIdentity },
            }),
            { _tag: 'log', tag: TAG },
          )
          if (!appended) return

          const recorded = Object.fromEntries(flagged.map(entry => [
            `instruction_load:${entry.instruction.path}:${['full', 'ref'][Number(entry.isReference)]}`,
            new Date().toISOString(),
          ]))
          yield* tokenStore.write(event.sessionID, { ...tokens, ...recorded })
        })
      })

      const seedNative = (): Effect.Effect<ReadonlySet<string> | undefined> => Effect.gen(function* () {
        const attempt = yield* attemptNative(
          event.sessionID,
          context.location.directory,
          context.storage,
          instructions,
          helpers,
        )
        return attempt.outcome === 'done'
          ? undefined
          : (yield* seedFallbackExclusions(
              event.sessionID,
              context.location.directory,
              helper,
              attempt.snapshot,
            ))
      })

      const seededFor = (): Effect.Effect<ReadonlySet<string> | undefined> =>
        instructions.length === 0
          ? Effect.succeed(undefined)
          : (carrier === 'native'
              ? seedNative()
              : seedSyntheticExclusions(
                  event.sessionID,
                  context.location.directory,
                  helper,
                  context.storage,
                ))

      const seeded = yield* seededFor()
      if (seeded === undefined) return

      yield* runSynthetic(seeded)
    }).pipe(Effect.orDie))

    yield* context.session.hook('compaction', event => Effect.gen(function* () {
      const sid = (event as { sessionID?: string }).sessionID ?? event.sessionID
      yield* context.storage.remove(seededKey(sid))
      yield* tokenStore.remove(sid)
      yield* Effect.logInfo(TAG + 'compaction: re-seeded token map for ' + sid)
    }))
    yield* Effect.logInfo(TAG + 'registered')
  }),
}

export default plugin
