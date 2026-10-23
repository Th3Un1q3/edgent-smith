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
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import { createIndex } from './helpers/instruction-indexer'
import { InstructionContextHelper } from './helpers/instruction-context-helper'
import {
  buildSteeringMessage,
  formatInstruction,
  instructionCollisions,
  instructionDescriptionKey,
  instructionEntryKey,
  instructionReferenceKey,
  instructionSlugFor,
  instructionSlugFromKey,
} from './helpers/instruction-payload'
import { MAX_ENTRY_VALUE_BYTES, entryValueBytes, listEntries } from './helpers/instruction-entry-client'
import type { InstructionEntry, InstructionValueObject } from './helpers/instruction-entry-client'
import {
  InstructionCarrierUnavailableError,
  classifyEntryFailure,
  isCarrierUnavailableReason,
  publishInstructionSet,
  resolveInjectionCarrier,
} from './helpers/instruction-carrier'
import type { CarrierStorage, InstructionEntryDraft, InstructionReferenceDraft } from './helpers/instruction-carrier'
import { getClient } from './helpers/service-client'
import type { ResolvedInstruction } from './types/instructions'

const TAG = '[instructions-loader] '
const TARGETED_TOOLS = new Set(['edit', 'write', 'read'])
const FULL_BODY_BUDGET = 5

const tokenKey = (sessionID: string): string => 'idempotency/' + sessionID
const pendingKey = (sessionID: string): string => 'pending/' + sessionID
// Synthetic seeding lists the native entries once per session; the marker lives
// in the same storage so a repeated synthetic touch does not re-list.
const seededKey = (sessionID: string): string => 'native-seed/' + sessionID

const readFilePath = (input: unknown): string | undefined => {
  const arguments_ = input as { path?: unknown, filePath?: unknown } | undefined
  const candidate = arguments_?.path ?? arguments_?.filePath
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

const pickAgent = (fromEvent: unknown, fromSession: unknown): string => {
  const candidate = typeof fromEvent === 'string' && fromEvent.length > 0 ? fromEvent : fromSession
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : 'build'
}

const isFullBodyValue = (value: unknown): boolean => {
  if (typeof value === 'string') return true
  return typeof value !== 'object' || value === null ? false : (value as { priority?: unknown }).priority === 0
}

const instructionIdentity = (instruction: ResolvedInstruction): string | undefined => {
  if (instruction.path !== undefined && instruction.path.length > 0) return instruction.path
  const description = instruction.description
  return typeof description === 'string' && description.length > 0 ? description : undefined
}

interface NativePlan {
  readonly entries: InstructionEntryDraft[]
  readonly removals: string[]
}

const collectCandidates = (instructions: readonly ResolvedInstruction[]): Map<string, ResolvedInstruction> => {
  const byIdentity = new Map<string, ResolvedInstruction>()
  for (const instruction of instructions) {
    const identity = instructionIdentity(instruction)
    if (identity === undefined) {
      process.emitWarning(`${TAG}skipping instruction without path or description (applyTo: ${instruction.applyTo ?? 'unknown'})`)
      continue
    }
    if (!byIdentity.has(identity)) byIdentity.set(identity, instruction)
  }
  return byIdentity
}

const fullBodyKeys = (snapshot: readonly InstructionEntry[]): Set<string> =>
  new Set(
    snapshot
      .filter(entry => keyRole(entry.key) === 'full' && isFullBodyValue(entry.value))
      .map(entry => entry.key),
  )

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

const descriptionDraft = (
  identity: string,
  instruction: ResolvedInstruction,
  collisions: ReadonlySet<string>,
): InstructionEntryDraft => ({
  identity,
  key: instructionDescriptionKey({ description: identity }, collisions),
  value: { text: buildSteeringMessage(formatInstruction(instruction, false)), source: identity, priority: 0 },
})

interface PathPlan {
  readonly draft: InstructionEntryDraft
  readonly removal?: string
}

const pathPlan = (
  identity: string,
  instruction: ResolvedInstruction,
  collisions: ReadonlySet<string>,
  fullKeys: ReadonlySet<string>,
  canTakeSlot: () => boolean,
): PathPlan => {
  const fullKey = instructionEntryKey({ path: identity }, collisions)
  const holdsFull = fullKeys.has(fullKey)
  const fullValue: InstructionValueObject = {
    text: buildSteeringMessage(formatInstruction(instruction, false)),
    source: identity,
    priority: 0,
  }
  const isOversize = entryValueBytes(fullValue) > MAX_ENTRY_VALUE_BYTES
  const useFull = !isOversize && (holdsFull || canTakeSlot())
  const reference: InstructionReferenceDraft = {
    key: instructionReferenceKey({ path: identity }, collisions),
    value: { text: buildSteeringMessage(formatInstruction(instruction, true)), source: identity, priority: 1 },
  }
  const draft: InstructionEntryDraft = useFull
    ? { identity, key: fullKey, value: fullValue, reference }
    : { identity, ...reference }
  return { draft, removal: useFull || !holdsFull ? undefined : fullKey }
}

const planNativeEntries = (
  instructions: readonly ResolvedInstruction[],
  snapshot: readonly InstructionEntry[],
  helpers: ReadonlyMap<string, InstructionContextHelper>,
): NativePlan => {
  const candidates = [...collectCandidates(instructions)].sort(([a], [b]) => a.localeCompare(b))
  const matched = candidates.map(([identity]) => identity)
  const collisions = pathFamilyCollisions(helpers, snapshot, matched)
  const descriptionCollisions = descriptionFamilyCollisions(
    snapshot,
    candidates.filter(([, instruction]) => instruction.path === undefined).map(([identity]) => identity),
  )
  const fullKeys = fullBodyKeys(snapshot)
  let slots = Math.max(0, FULL_BODY_BUDGET - fullKeys.size)
  const canTakeSlot = (): boolean => {
    if (slots <= 0) return false
    slots--
    return true
  }

  const entries: InstructionEntryDraft[] = []
  const removals = new Set<string>()
  for (const [identity, instruction] of candidates) {
    if (instruction.path === undefined) {
      entries.push(descriptionDraft(identity, instruction, descriptionCollisions))
      continue
    }
    const plan = pathPlan(identity, instruction, collisions, fullKeys, canTakeSlot)
    entries.push(plan.draft)
    if (plan.removal !== undefined) removals.add(plan.removal)
  }
  return { entries, removals: [...removals] }
}

const slugIdentities = (paths: readonly string[]): Map<string, string> => {
  const identities = [...new Set(paths)]
  const collisions = instructionCollisions(identities.map(path => ({ path })))
  const bySlug = new Map<string, string>()
  for (const identity of identities) {
    const slug = instructionSlugFor({ path: identity })
    const key = collisions.has(slug)
      ? instructionSlugFromKey(instructionEntryKey({ path: identity }, collisions))
      : slug
    bySlug.set(key, identity)
  }
  return bySlug
}

const objectSource = (value: unknown): string | undefined => {
  if (typeof value !== 'object' || value === null) return undefined
  const source = (value as { source?: unknown }).source
  return typeof source === 'string' && source.length > 0 ? source : undefined
}

const legacyIdentity = (
  key: string,
  value: unknown,
  bySlug: ReadonlyMap<string, string>,
): string | undefined => {
  return typeof value !== 'string' || key.startsWith('instr-task-skills-') ? undefined : bySlug.get(instructionSlugFromKey(key))
}

const liveIdentities = (helpers: ReadonlyMap<string, InstructionContextHelper>): Set<string> => {
  const identities = new Set<string>()
  for (const helper of helpers.values()) for (const identity of helper.allPaths) identities.add(identity)
  return identities
}

const snapshotIdentity = (
  entry: InstructionEntry,
  bySlug: ReadonlyMap<string, string>,
): string | undefined => objectSource(entry.value) ?? legacyIdentity(entry.key, entry.value, bySlug)

const identityCollisions = (identities: Iterable<string>): ReadonlySet<string> =>
  instructionCollisions([...identities].map(identity => ({ path: identity })))

// A key is reproducible only from the identities that could own its slug this
// touch: the index (including files no agent matched), the snapshot, and the
// matches. A hashed key stays hashed while its colliding partner is indexed.
const pathFamilyCollisions = (
  helpers: ReadonlyMap<string, InstructionContextHelper>,
  snapshot: readonly InstructionEntry[],
  matched: readonly string[],
): ReadonlySet<string> => {
  const livePaths = liveIdentities(helpers)
  const bySlug = slugIdentities([...livePaths])
  const identities = new Set<string>(livePaths)
  for (const entry of snapshot) {
    const identity = snapshotIdentity(entry, bySlug)
    if (identity !== undefined) identities.add(identity)
  }
  for (const identity of matched) identities.add(identity)
  return identityCollisions(identities)
}

// Description keys are not index-derived, so their family collides only with
// the identities already stored in it plus this touch's path-less matches.
const descriptionFamilyCollisions = (
  snapshot: readonly InstructionEntry[],
  pathless: readonly string[],
): ReadonlySet<string> => {
  const identities = new Set<string>(pathless)
  for (const entry of snapshot) {
    if (keyRole(entry.key) !== 'description') continue
    const identity = objectSource(entry.value) ?? instructionSlugFromKey(entry.key)
    if (identity.length > 0) identities.add(identity)
  }
  return identityCollisions(identities)
}

type KeyRole = 'full' | 'reference' | 'description'

const keyRole = (key: string): KeyRole | undefined => {
  if (key.startsWith('instr-ref-')) return 'reference'
  if (key.startsWith('instr-desc-')) return 'description'
  return !key.startsWith('instr-') || key.startsWith('instr-task-skills-') ? undefined : 'full'
}

interface LiveKeys {
  readonly full: Set<string>
  readonly reference: Set<string>
  readonly touched: Set<string>
}

const draftLiveKeys = (drafts: readonly InstructionEntryDraft[]): LiveKeys => {
  const live: LiveKeys = { full: new Set(), reference: new Set(), touched: new Set() }
  for (const draft of drafts) {
    const role = keyRole(draft.key)
    if (role === undefined || role === 'description') continue
    live.touched.add(draft.identity)
    live[role].add(draft.key)
  }
  return live
}

const untouchedLiveKey = (
  entries: readonly InstructionEntry[],
): { readonly role: 'full' | 'reference', readonly key: string } | undefined => {
  const full = entries.find(entry => keyRole(entry.key) === 'full' && isFullBodyValue(entry.value))
  if (full !== undefined) return { role: 'full', key: full.key }
  const reference = entries.find(entry => keyRole(entry.key) === 'reference')
  return reference === undefined ? undefined : { role: 'reference', key: reference.key }
}

const isDeadKey = (key: string, live: LiveKeys): boolean => {
  const role = keyRole(key)
  return (role === 'full' || role === 'reference') && !live[role].has(key)
}

// One live key per identity: a key superseded by this touch's role decision, or
// by a key of the other family, must die even though its file still exists.
const sweepRemovals = (
  snapshot: readonly InstructionEntry[],
  drafts: readonly InstructionEntryDraft[],
  livePaths: ReadonlySet<string>,
): string[] => {
  const bySlug = slugIdentities([...livePaths])
  const live = draftLiveKeys(drafts)
  for (const identity of livePaths) {
    if (live.touched.has(identity)) continue
    const entry = untouchedLiveKey(snapshot.filter(candidate => snapshotIdentity(candidate, bySlug) === identity))
    if (entry !== undefined) live[entry.role].add(entry.key)
  }
  return snapshot.filter(entry => isDeadKey(entry.key, live)).map(entry => entry.key)
}

const seededIdentities = (
  entries: readonly InstructionEntry[],
  helper: InstructionContextHelper,
): ReadonlySet<string> => {
  const bySlug = slugIdentities(helper.allPaths)
  const seeded = new Set<string>()
  for (const entry of entries) {
    if (!entry.key.startsWith('instr-')) continue
    const identity = objectSource(entry.value) ?? legacyIdentity(entry.key, entry.value, bySlug)
    if (identity !== undefined) seeded.add(identity)
  }
  return seeded
}

const attempt = <A>(run: () => Promise<A>) =>
  Effect.result(Effect.tryPromise({ try: run, catch: (error: unknown) => error }))

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

const seedFallbackExclusions = (
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
const seedSyntheticExclusions = (
  sessionID: string,
  directory: string,
  helper: InstructionContextHelper,
  storage: Context['storage'],
): Effect.Effect<ReadonlySet<string>> => Effect.gen(function* () {
  if ((yield* storage.get(seededKey(sessionID))) === true) return new Set<string>()
  const seeded = yield* seededFromList(sessionID, directory, helper, 'synthetic')
  yield* storage.set(seededKey(sessionID), true)
  return seeded
})

const requireEntryMethod = async (directory: string): Promise<void> => {
  const client = await getClient(undefined, directory)
  const entry = (client as unknown as { session?: { instructions?: { entry?: unknown } } })
    .session?.instructions?.entry
  if (entry === undefined) throw new InstructionCarrierUnavailableError('method-absent')
}

const carrierStorageFor = (storage: Context['storage']): CarrierStorage => ({
  get: key => Effect.runPromise(storage.get(key)),
  set: (key, value) => Effect.runPromise(storage.set(key, value as Parameters<Context['storage']['set']>[1])),
  remove: key => Effect.runPromise(storage.remove(key)),
})

interface NativeAttempt {
  readonly outcome: 'done' | 'fallback'
  // The touch's single list, reused by fallback seeding instead of listing again.
  readonly snapshot?: readonly InstructionEntry[]
}

const attemptNative = (
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
    const failure = classifyEntryFailure(listed.failure)
    if (!isCarrierUnavailableReason(failure)) {
      yield* Effect.logWarning(TAG + `instruction list failed (${failure}); skipping this turn`)
      return { outcome: 'done' }
    }
    return { outcome: 'fallback' }
  }

  const plan = planNativeEntries(instructions, listed.success, helpers)
  const removals = new Set(plan.removals)
  for (const key of sweepRemovals(listed.success, plan.entries, liveIdentities(helpers))) removals.add(key)
  const published = yield* attempt(() => publishInstructionSet({
    sessionID,
    directory,
    entries: plan.entries,
    removals: [...removals],
    snapshot: listed.success,
    storage: carrierStorageFor(storage),
  }))

  return published._tag === 'Failure' || published.success.outcome !== 'fallback' ? { outcome: 'done' } : { outcome: 'fallback', snapshot: listed.success }
})

const plugin: Plugin = {
  id: 'opencode.instructions-loader',
  effect: context => Effect.gen(function* () {
    const helpers = new Map<string, InstructionContextHelper>()

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
      if (filePath === undefined || !TARGETED_TOOLS.has(event.tool)) return
      const session = yield* context.session.get({ sessionID: event.sessionID })
      const agent = pickAgent(event.agent, (session as { agent?: unknown }).agent)
      const carrier = resolveInjectionCarrier(process.env, agent)
      yield* Effect.logDebug(`carrier=${carrier} agent=${agent}`)
      const helper = yield* Effect.promise(() => makeHelper(agent))
      const instructions = yield* Effect.promise(() => helper.resolveInstructions([filePath]))
      if (instructions.length === 0) return

      const runSynthetic = (seeded: ReadonlySet<string>) => Effect.gen(function* () {
        const stored = ((yield* context.storage.get(tokenKey(event.sessionID))) as Record<string, string> | undefined) ?? {}
        const seededTokens = Object.fromEntries(
          [...seeded].map(identity => [`instruction_load:${identity}`, new Date().toISOString()]),
        )
        const tokens: Record<string, string> = { ...seededTokens, ...stored }
        if (seeded.size > 0) yield* context.storage.set(tokenKey(event.sessionID), tokens)
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
        let slots = Math.max(0, FULL_BODY_BUDGET - fullCount)
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
      })

      let seeded: ReadonlySet<string> = new Set<string>()

      if (carrier === 'native') {
        const attempt = yield* attemptNative(
          event.sessionID,
          context.location.directory,
          context.storage,
          instructions,
          helpers,
        )
        if (attempt.outcome === 'done') return
        seeded = yield* seedFallbackExclusions(
          event.sessionID,
          context.location.directory,
          helper,
          attempt.snapshot,
        )
      }
      else {
        seeded = yield* seedSyntheticExclusions(
          event.sessionID,
          context.location.directory,
          helper,
          context.storage,
        )
      }

      yield* runSynthetic(seeded)
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
