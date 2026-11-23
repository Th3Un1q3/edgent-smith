import type { InstructionContextHelper } from './context-helper'
import type { InstructionEntry } from '../helpers/instructions/entry-client'
import {
  instructionCollisions,
  instructionEntryKey,
  instructionSlugFor,
  instructionSlugFromKey,
} from '../helpers/instructions/payload'
import type { ResolvedInstruction } from '../types/instructions'

export type KeyRole = 'full' | 'reference' | 'description'

const KEY_ROLES: ReadonlyArray<readonly [string, KeyRole | undefined]> = [
  ['instr-ref-', 'reference'],
  ['instr-desc-', 'description'],
  ['instr-task-skills-', undefined],
  ['instr-', 'full'],
]

export const keyRole = (key: string): KeyRole | undefined =>
  KEY_ROLES.find(([prefix]) => key.startsWith(prefix))?.[1]

export const isFullBodyValue = (value: unknown): boolean =>
  typeof value === 'object' && value !== null
    ? (value as { priority?: unknown }).priority === 0
    : typeof value === 'string'

const nonEmptyString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

export const instructionIdentity = (instruction: ResolvedInstruction): string | undefined =>
  nonEmptyString(instruction.path) ?? nonEmptyString(instruction.description)

export const slugIdentities = (paths: readonly string[]): Map<string, string> => {
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

export const objectSource = (value: unknown): string | undefined => {
  return typeof value !== 'object' || value === null ? undefined : nonEmptyString((value as { source?: unknown }).source)
}

export const legacyIdentity = (
  key: string,
  value: unknown,
  bySlug: ReadonlyMap<string, string>,
): string | undefined => {
  return typeof value !== 'string' || key.startsWith('instr-task-skills-') ? undefined : bySlug.get(instructionSlugFromKey(key))
}

export const liveIdentities = (helpers: ReadonlyMap<string, InstructionContextHelper>): Set<string> => {
  const identities = new Set<string>()
  for (const helper of helpers.values()) for (const identity of helper.allPaths) identities.add(identity)
  return identities
}

export const snapshotIdentity = (
  entry: InstructionEntry,
  bySlug: ReadonlyMap<string, string>,
): string | undefined => objectSource(entry.value) ?? legacyIdentity(entry.key, entry.value, bySlug)

export const identityCollisions = (identities: Iterable<string>): ReadonlySet<string> =>
  instructionCollisions([...identities].map(identity => ({ path: identity })))

// A key is reproducible only from the identities that could own its slug this
// touch: the index (including files no agent matched), the snapshot, and the
// matches. A hashed key stays hashed while its colliding partner is indexed.
export const pathFamilyCollisions = (
  helpers: ReadonlyMap<string, InstructionContextHelper>,
  snapshot: readonly InstructionEntry[],
  matched: readonly string[],
): ReadonlySet<string> => {
  const livePaths = liveIdentities(helpers)
  const bySlug = slugIdentities([...livePaths])
  const identities = new Set<string>([...livePaths, ...matched])
  for (const entry of snapshot) {
    const identity = snapshotIdentity(entry, bySlug)
    if (identity !== undefined) identities.add(identity)
  }
  return identityCollisions(identities)
}

// Description keys are not index-derived, so their family collides only with
// the identities already stored in it plus this touch's path-less matches.
const descriptionIdentity = (entry: InstructionEntry): string | undefined =>
  nonEmptyString(objectSource(entry.value) ?? instructionSlugFromKey(entry.key))

export const descriptionFamilyCollisions = (
  snapshot: readonly InstructionEntry[],
  pathless: readonly string[],
): ReadonlySet<string> => {
  const identities = new Set<string>(pathless)
  for (const entry of snapshot) {
    const identity = descriptionIdentity(entry)
    if (identity !== undefined) identities.add(identity)
  }
  return identityCollisions(identities)
}

export const seededIdentities = (
  entries: readonly InstructionEntry[],
  helper: InstructionContextHelper,
): ReadonlySet<string> => {
  const bySlug = slugIdentities(helper.allPaths)
  const identities = entries
    .filter(entry => entry.key.startsWith('instr-'))
    .map(entry => snapshotIdentity(entry, bySlug))
  return new Set(identities.filter((identity): identity is string => identity !== undefined))
}
