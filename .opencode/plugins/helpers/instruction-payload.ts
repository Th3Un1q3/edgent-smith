import { createHash } from 'node:crypto'

import type { ResolvedInstruction } from '../types/instructions'

const INSTRUCTIONS_PREFIX = '.opencode/instructions/'
const INSTRUCTIONS_SUFFIX = '.instructions.md'
const API_PREFIX = 'api/'
const HASH_LENGTH = 7
const EMPTY_COLLISIONS: ReadonlySet<string> = new Set()

type InstructionIdentity = { readonly path?: string, readonly description?: string }

export const formatInstruction = (instruction: ResolvedInstruction, isReference: boolean): string => {
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

export const buildSteeringMessage = (blocks: string): string =>
  `<steering priority="high" reason="relevant files touched" type="instructions">\n${blocks}\n</steering>`

const identityOf = (instruction: InstructionIdentity): string =>
  instruction.path ?? instruction.description ?? ''

export const instructionSlugFor = (instruction: InstructionIdentity): string => {
  const identity = identityOf(instruction)
  const prefixIndex = identity.indexOf(INSTRUCTIONS_PREFIX)
  const withoutPrefix = prefixIndex === -1
    ? identity
    : identity.slice(prefixIndex + INSTRUCTIONS_PREFIX.length)
  const withoutSuffix = withoutPrefix.endsWith(INSTRUCTIONS_SUFFIX)
    ? withoutPrefix.slice(0, -INSTRUCTIONS_SUFFIX.length)
    : withoutPrefix
  const slug = withoutSuffix
    .toLowerCase()
    .replaceAll(/[^a-z0-9._-]/gu, '-')
    .replaceAll(/-{2,}/gu, '-')
  if (slug === '') return '0'
  return /^[a-z0-9]/u.test(slug) ? slug : `0${slug.slice(1)}`
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
