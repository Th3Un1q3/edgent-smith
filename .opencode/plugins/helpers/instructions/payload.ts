import { createHash } from 'node:crypto'

import type { ResolvedInstruction } from '../../types/instructions'

const INSTRUCTIONS_PREFIX = '.opencode/instructions/'
const INSTRUCTIONS_SUFFIX = '.instructions.md'
const API_PREFIX = 'api/'
const HASH_LENGTH = 7
const EMPTY_COLLISIONS: ReadonlySet<string> = new Set()

export { buildSteeringMessage } from '../session/steering-message'

type InstructionIdentity = { readonly path?: string, readonly description?: string }

const referenceMeta = (content: string | undefined): string =>
  content ? ` lines="${content.split('\n').length}" chars="${content.length}"` : ''

export const formatInstruction = (instruction: ResolvedInstruction, isReference: boolean): string => {
  return isReference
    ? [
        '<instruction>',
        `  <description>${instruction.description}</description>`,
        `  <path>${instruction.path}</path>`,
        `  <meta${referenceMeta(instruction.content)}/>`,
        '</instruction>',
      ].join('\n')
    : [
        '<instruction>',
        `  <description>${instruction.description}</description>`,
        `  <path>${instruction.path}</path>`,
        '  <content>',
        instruction.content ?? '',
        '  </content>',
        '</instruction>',
      ].join('\n')
}

const identityOf = (instruction: InstructionIdentity): string =>
  instruction.path ?? instruction.description ?? ''

const stripSuffix = (value: string, suffix: string): string =>
  value.endsWith(suffix) ? value.slice(0, -suffix.length) : value

const stripPrefixThrough = (value: string, prefix: string): string => {
  const at = value.indexOf(prefix)
  return at === -1 ? value : value.slice(at + prefix.length)
}

export const instructionSlugFor = (instruction: InstructionIdentity): string => {
  const identity = identityOf(instruction)
  const withoutPrefix = stripPrefixThrough(identity, INSTRUCTIONS_PREFIX)
  const withoutSuffix = stripSuffix(withoutPrefix, INSTRUCTIONS_SUFFIX)
  const slug = withoutSuffix
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]/gu, '-')
    .replaceAll(/-{2,}/gu, '-')
  return slug === '' ? '0' : slug.replace(/^[^a-z0-9]/u, '0')
}

export const stripApiPrefix = (key: string): string =>
  key.startsWith(API_PREFIX) ? key.slice(API_PREFIX.length) : key

const FAMILY_PREFIXES = ['instr-ref-', 'instr-desc-', 'instr-task-skills-', 'instr-'] as const

export const instructionSlugFromKey = (key: string): string => {
  const bare = stripApiPrefix(key)
  const prefix = FAMILY_PREFIXES.find(candidate => bare.startsWith(candidate))
  return prefix === undefined ? bare : bare.slice(prefix.length)
}

const slugHash = (identity: string): string =>
  createHash('sha256').update(identity, 'utf8').digest('hex').slice(0, HASH_LENGTH)

/**
 * Slugs shared by more than one identity in a family. Both colliding identities
 * take the hash suffix, so no bare key survives a collision.
 */
export const instructionCollisions = (identities: readonly InstructionIdentity[]): ReadonlySet<string> => {
  const seen = new Set<string>()
  const collisions = new Set<string>()
  for (const identity of identities) {
    const slug = instructionSlugFor(identity)
    if (seen.has(slug)) collisions.add(slug)
    seen.add(slug)
  }
  return collisions
}

const familyKey = (
  prefix: string,
  instruction: InstructionIdentity,
  collisions: ReadonlySet<string>,
): string => {
  const slug = instructionSlugFor(instruction)
  const suffix = collisions.has(slug) ? `-${slugHash(identityOf(instruction))}` : ''
  return `${prefix}${slug}${suffix}`
}

export const instructionEntryKey = (
  instruction: InstructionIdentity,
  collisions: ReadonlySet<string> = EMPTY_COLLISIONS,
): string => familyKey('instr-', instruction, collisions)

export const instructionReferenceKey = (
  instruction: InstructionIdentity,
  collisions: ReadonlySet<string> = EMPTY_COLLISIONS,
): string => familyKey('instr-ref-', instruction, collisions)

export const instructionDescriptionKey = (
  instruction: InstructionIdentity,
  collisions: ReadonlySet<string> = EMPTY_COLLISIONS,
): string => familyKey('instr-desc-', instruction, collisions)
