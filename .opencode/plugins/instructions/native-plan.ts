import type { InstructionContextHelper } from './context-helper'
import type { InstructionEntry, InstructionValueObject } from '../helpers/instructions/entry-client'
import type { InstructionEntryDraft, InstructionReferenceDraft } from './carrier'
import { MAX_ENTRY_VALUE_BYTES, entryValueBytes } from '../helpers/instructions/entry-client'
import {
  descriptionFamilyCollisions,
  instructionIdentity,
  isFullBodyValue,
  keyRole,
  pathFamilyCollisions,
  slugIdentities,
  snapshotIdentity,
} from './identity'
import {
  buildSteeringMessage,
  formatInstruction,
  instructionDescriptionKey,
  instructionEntryKey,
  instructionReferenceKey,
} from '../helpers/instructions/payload'
import { TAG } from './diagnostics'
import type { ResolvedInstruction } from '../types/instructions'

export const FULL_BODY_BUDGET = 5

export interface NativePlan {
  readonly entries: InstructionEntryDraft[]
  readonly removals: string[]
}

const warnMissingIdentity = (instruction: ResolvedInstruction): void => {
  process.emitWarning(`${TAG}skipping instruction without path or description (applyTo: ${instruction.applyTo ?? 'unknown'})`)
}

const addCandidate = (byIdentity: Map<string, ResolvedInstruction>, instruction: ResolvedInstruction): void => {
  const identity = instructionIdentity(instruction)

  if (identity === undefined) warnMissingIdentity(instruction)
  else if (!byIdentity.has(identity)) byIdentity.set(identity, instruction)
}

export const collectCandidates = (instructions: readonly ResolvedInstruction[]): Map<string, ResolvedInstruction> => {
  const byIdentity = new Map<string, ResolvedInstruction>()
  for (const instruction of instructions) addCandidate(byIdentity, instruction)
  return byIdentity
}

const fullBodyKeys = (snapshot: readonly InstructionEntry[]): Set<string> =>
  new Set(
    snapshot
      .filter(entry => keyRole(entry.key) === 'full' && isFullBodyValue(entry.value))
      .map(entry => entry.key),
  )

const descriptionDraft = (
  identity: string,
  instruction: ResolvedInstruction,
  collisions: ReadonlySet<string>,
): InstructionEntryDraft => ({
  identity,
  key: instructionDescriptionKey({ description: identity }, collisions),
  value: { text: buildSteeringMessage(formatInstruction(instruction, false)), source: identity, priority: 0 },
})

const canUseFull = (fullValue: InstructionValueObject, hasFull: boolean, canTakeSlot: () => boolean): boolean =>
  entryValueBytes(fullValue) <= MAX_ENTRY_VALUE_BYTES && (hasFull || canTakeSlot())

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
  const reference: InstructionReferenceDraft = {
    key: instructionReferenceKey({ path: identity }, collisions),
    value: { text: buildSteeringMessage(formatInstruction(instruction, true)), source: identity, priority: 1 },
  }
  const isUseFull = canUseFull(fullValue, holdsFull, canTakeSlot)

  return isUseFull ? { draft: { identity, key: fullKey, value: fullValue, reference } } : { draft: { identity, ...reference }, removal: holdsFull ? fullKey : undefined }
}

const pushPlan = (entries: InstructionEntryDraft[], removals: Set<string>, plan: PathPlan): void => {
  entries.push(plan.draft)

  if (plan.removal !== undefined) removals.add(plan.removal)
}

export const planNativeEntries = (
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
    pushPlan(entries, removals, pathPlan(identity, instruction, collisions, fullKeys, canTakeSlot))
  }
  return { entries, removals: [...removals] }
}

interface LiveKeys {
  readonly full: Set<string>
  readonly reference: Set<string>
  readonly touched: Set<string>
}

const isLiveRole = (role: ReturnType<typeof keyRole>): role is 'full' | 'reference' =>
  role === 'full' || role === 'reference'

const draftLiveKeys = (drafts: readonly InstructionEntryDraft[]): LiveKeys => {
  const live: LiveKeys = { full: new Set(), reference: new Set(), touched: new Set() }
  for (const draft of drafts) {
    const role = keyRole(draft.key)

    if (!isLiveRole(role)) continue

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
  return isLiveRole(role) && !live[role].has(key)
}

const adoptUntouchedKey = (
  snapshot: readonly InstructionEntry[],
  bySlug: ReturnType<typeof slugIdentities>,
  live: LiveKeys,
  identity: string,
): void => {
  const entry = untouchedLiveKey(snapshot.filter(candidate => snapshotIdentity(candidate, bySlug) === identity))

  if (entry !== undefined) live[entry.role].add(entry.key)
}

// One live key per identity: a key superseded by this touch's role decision, or
// by a key of the other family, must die even though its file still exists.
export const sweepRemovals = (
  snapshot: readonly InstructionEntry[],
  drafts: readonly InstructionEntryDraft[],
  livePaths: ReadonlySet<string>,
): string[] => {
  const bySlug = slugIdentities([...livePaths])
  const live = draftLiveKeys(drafts)
  for (const identity of livePaths) {
    if (live.touched.has(identity)) continue

    adoptUntouchedKey(snapshot, bySlug, live, identity)
  }
  return snapshot.filter(entry => isDeadKey(entry.key, live)).map(entry => entry.key)
}
