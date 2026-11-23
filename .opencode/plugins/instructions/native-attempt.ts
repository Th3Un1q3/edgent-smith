import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import type { InstructionContextHelper } from './context-helper'
import type { InstructionEntry } from '../helpers/instructions/entry-client'
import { listEntries } from '../helpers/instructions/entry-client'
import {
  InstructionCarrierUnavailableError,
  classifyEntryFailure,
  isCarrierUnavailableReason,
  publishInstructionSet,
} from './carrier'
import type { CarrierStorage } from './carrier'
import { liveIdentities } from './identity'
import { planNativeEntries, sweepRemovals } from './native-plan'
import { getClient } from '../helpers/runtime/service-client'
import { TAG, attempt } from './diagnostics'
import type { ResolvedInstruction } from '../types/instructions'

const hasEntryMethod = (client: unknown): boolean =>
  (client as unknown as { session?: { instructions?: { entry?: unknown } } }).session?.instructions?.entry !== undefined

const requireEntryMethod = async (directory: string): Promise<void> => {
  const client = await getClient(undefined, directory)
  if (!hasEntryMethod(client)) throw new InstructionCarrierUnavailableError('method-absent')
}

const carrierStorageFor = (storage: Context['storage']): CarrierStorage => ({
  get: key => Effect.runPromise(storage.get(key)),
  set: (key, value) => Effect.runPromise(storage.set(key, value as Parameters<Context['storage']['set']>[1])),
  remove: key => Effect.runPromise(storage.remove(key)),
})

const settleListFailure = (failure: ReturnType<typeof classifyEntryFailure>): Effect.Effect<NativeAttempt> =>
  Effect.gen(function* () {
    if (isCarrierUnavailableReason(failure)) return { outcome: 'fallback' }
    yield* Effect.logWarning(TAG + `instruction list failed (${failure}); skipping this turn`)
    return { outcome: 'done' }
  })

const publishOutcome = (requiresFallback: boolean, snapshot: readonly InstructionEntry[]): NativeAttempt =>
  requiresFallback ? { outcome: 'fallback', snapshot } : { outcome: 'done' }

export interface NativeAttempt {
  readonly outcome: 'done' | 'fallback'
  // The touch's single list, reused by fallback seeding instead of listing again.
  readonly snapshot?: readonly InstructionEntry[]
}

export const attemptNative = (
  sessionID: string,
  directory: string,
  storage: Context['storage'],
  instructions: readonly ResolvedInstruction[],
  helpers: ReadonlyMap<string, InstructionContextHelper>,
): Effect.Effect<NativeAttempt> => Effect.gen(function* () {
  const listed = yield* attempt(async () => {
    await requireEntryMethod(directory)
    return await listEntries(sessionID, directory)
  })

  if (listed._tag === 'Failure') {
    return yield* settleListFailure(classifyEntryFailure(listed.failure))
  }

  const plan = planNativeEntries(instructions, listed.success, helpers)
  const removals = new Set([
    ...plan.removals,
    ...sweepRemovals(listed.success, plan.entries, liveIdentities(helpers)),
  ])
  const published = yield* attempt(() => publishInstructionSet({
    sessionID,
    directory,
    entries: plan.entries,
    removals: [...removals],
    snapshot: listed.success,
    storage: carrierStorageFor(storage),
  }))

  return publishOutcome(published._tag !== 'Failure' && published.success.outcome === 'fallback', listed.success)
})
