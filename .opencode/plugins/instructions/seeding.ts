import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import type { InstructionContextHelper } from './context-helper'
import type { InstructionEntry } from '../helpers/instructions/entry-client'
import { listEntries, removeEntry } from '../helpers/instructions/entry-client'
import { classifyEntryFailure } from './carrier'
import { seededIdentities } from './identity'
import { TAG, attempt } from './diagnostics'

// Synthetic seeding lists the native entries once per session; the marker lives
// in the same storage so a repeated synthetic touch does not re-list.
export const seededKey = (sessionID: string): string => 'native-seed/' + sessionID

const seededFromList = (
  sessionID: string,
  directory: string,
  helper: InstructionContextHelper,
  kind: 'fallback' | 'synthetic',
): Effect.Effect<ReadonlySet<string>> => Effect.gen(function* () {
  const listed = yield* attempt(() => listEntries(sessionID, directory))
  if (listed._tag === 'Failure') {
    yield* Effect.logWarning(
      TAG + `${kind} seeding list failed (${classifyEntryFailure(listed.failure)}); duplicate delivery preferred`,
    )
    return new Set<string>()
  }
  return seededIdentities(listed.success, helper)
})

export const seedFallbackExclusions = (
  sessionID: string,
  directory: string,
  helper: InstructionContextHelper,
  snapshot?: readonly InstructionEntry[],
): Effect.Effect<ReadonlySet<string>> => Effect.gen(function* () {
  return snapshot === undefined ? (yield* seededFromList(sessionID, directory, helper, 'fallback')) : seededIdentities(snapshot, helper)
})

// D-08: a native -> synthetic switch seeds from the entries the native path
// published, so an already-delivered block is not sent twice. The marker makes
// the list once per session; a failed list seeds nothing and never deletes.
export const seedSyntheticExclusions = (
  sessionID: string,
  directory: string,
  helper: InstructionContextHelper,
  storage: Context['storage'],
): Effect.Effect<ReadonlySet<string>> => Effect.gen(function* () {
  if ((yield* storage.get(seededKey(sessionID))) === true) return new Set<string>()
  // Drain native entries from an upgrading session so they stop rendering in
  // the system array alongside the appended messages (one-time migration).
  const listed = yield* attempt(() => listEntries(sessionID, directory))
  if (listed._tag === 'Failure') {
    yield* Effect.logWarning(TAG + `synthetic seeding list failed (${classifyEntryFailure(listed.failure)})`)
    yield* storage.set(seededKey(sessionID), true)
    return new Set<string>()
  }
  const nativeKeys = listed.success
    .filter(candidate => candidate.key.startsWith('instr-'))
    .map(candidate => candidate.key)
  yield* drainNatives(sessionID, directory, nativeKeys)
  yield* storage.set(seededKey(sessionID), true)
  return seededIdentities(listed.success, helper)
})

const drainNatives = (
  sessionID: string,
  directory: string,
  keys: readonly string[],
): Effect.Effect<void> => Effect.gen(function* () {
  for (const key of keys) {
    yield* attempt(() => removeEntry(sessionID, key, undefined, directory))
  }
})
