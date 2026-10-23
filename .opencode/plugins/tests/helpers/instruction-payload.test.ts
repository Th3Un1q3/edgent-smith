import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  buildSteeringMessage,
  formatInstruction,
  instructionCollisions,
  instructionDescriptionKey,
  instructionEntryKey,
  instructionReferenceKey,
  instructionSlugFor,
  instructionSlugFromKey,
  stripApiPrefix,
} from '@plugins/helpers/instruction-payload'
import type { ResolvedInstruction } from '@plugins/types/instructions'

const resolved = (overrides: Partial<ResolvedInstruction>): ResolvedInstruction => ({
  idempotencyKey: 'key',
  ...overrides,
})

const shortHash = (identity: string): string =>
  createHash('sha256').update(identity).digest('hex').slice(0, 7)

describe('instruction payload rendering', () => {
  it('renders a full body with description, path and content', () => {
    const rendered = formatInstruction(
      resolved({ description: 'Comment rules', path: '/repo/.opencode/instructions/comments.instructions.md', content: 'line one\nline two' }),
      false,
    )

    expect(rendered).toBe([
      '<instruction>',
      '  <description>Comment rules</description>',
      '  <path>/repo/.opencode/instructions/comments.instructions.md</path>',
      '  <content>',
      'line one\nline two',
      '  </content>',
      '</instruction>',
    ].join('\n'))
  })

  it('renders a reference with line and character counts instead of content', () => {
    const rendered = formatInstruction(
      resolved({ description: 'Comment rules', path: '/p/c.instructions.md', content: 'abc\nde' }),
      true,
    )

    expect(rendered).toBe([
      '<instruction>',
      '  <description>Comment rules</description>',
      '  <path>/p/c.instructions.md</path>',
      '  <meta lines="2" chars="6"/>',
      '</instruction>',
    ].join('\n'))
  })

  it('omits the meta attributes when a reference has no content', () => {
    const rendered = formatInstruction(
      resolved({ description: 'Comment rules', path: '/p/c.instructions.md' }),
      true,
    )

    expect(rendered).toContain('<meta/>')
    expect(rendered).not.toContain('<content>')
  })

  it('wraps blocks in the high-priority steering element', () => {
    expect(buildSteeringMessage('<instruction></instruction>')).toBe(
      '<steering priority="high" reason="relevant files touched" type="instructions">\n<instruction></instruction>\n</steering>',
    )
  })
})

describe('instruction slugs', () => {
  it('strips the instructions prefix and suffix, then lowercases', () => {
    expect(instructionSlugFor({ path: '/repo/.opencode/instructions/API-Style.instructions.md' })).toBe('api-style')
  })

  it('keeps dots, underscores and hyphens inside the slug', () => {
    expect(instructionSlugFor({ path: 'a.b_c-d.instructions.md' })).toBe('a.b_c-d')
  })

  it('maps other characters and collapses the runs they create', () => {
    expect(instructionSlugFor({ path: '/repo/.opencode/instructions/a  b!!c.instructions.md' })).toBe('a-b-c')
  })

  it('turns a nested path into a hyphenated slug', () => {
    expect(instructionSlugFor({ path: 'nested/dir/file.instructions.md' })).toBe('nested-dir-file')
  })

  it('an instruction without a path takes the slug of its description', () => {
    expect(instructionSlugFor({ description: 'Review the migration plan' })).toBe('review-the-migration-plan')
    expect(instructionDescriptionKey({ description: 'Review the migration plan' })).toBe('instr-desc-review-the-migration-plan')
  })

  it('slug repairs a leading character', () => {
    expect(instructionSlugFor({ description: '.hidden' })).toBe('0hidden')
    expect(instructionSlugFor({ description: '_private' })).toBe('0private')
  })

  it('always produces the expected key-safe slug', () => {
    const slugs = ['.hidden', 'Review the migration plan', '', '---', 'A/B']
      .map(description => instructionSlugFor({ description }))

    expect(slugs).toEqual(['0hidden', 'review-the-migration-plan', '0', '0', 'a-b'])
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9][a-z0-9._-]*$/u)
  })
})

describe('instruction keys', () => {
  it('builds the three loader families from one identity', () => {
    const instruction = { path: '/repo/.opencode/instructions/Review.instructions.md' }

    expect(instructionEntryKey(instruction)).toBe('instr-review')
    expect(instructionReferenceKey(instruction)).toBe('instr-ref-review')
    expect(instructionDescriptionKey(instruction)).toBe('instr-desc-review')
  })

  it('two identities that collapse to one slug both take the hash suffix', () => {
    const identities = [
      { path: '/repo/.opencode/instructions/Review.instructions.md' },
      { path: '/repo/.opencode/instructions/review.instructions.md' },
    ] as const
    const [first, second] = identities
    const collisions = instructionCollisions(identities)

    expect(collisions).toEqual(new Set(['review']))
    expect(instructionEntryKey(first, collisions)).toBe(`instr-review-${shortHash(first.path)}`)
    expect(instructionEntryKey(second, collisions)).toBe(`instr-review-${shortHash(second.path)}`)
    expect(instructionReferenceKey(first, collisions)).toBe(`instr-ref-review-${shortHash(first.path)}`)
  })

  it('leaves a unique slug bare', () => {
    const identities = [
      { path: '/repo/.opencode/instructions/one.instructions.md' },
      { path: '/repo/.opencode/instructions/two.instructions.md' },
    ] as const

    expect(instructionCollisions(identities)).toEqual(new Set())
    expect(instructionEntryKey(identities[0], instructionCollisions(identities))).toBe('instr-one')
  })

  it('recovers the slug from every family key', () => {
    expect(instructionSlugFromKey('instr-review')).toBe('review')
    expect(instructionSlugFromKey('instr-ref-review')).toBe('review')
    expect(instructionSlugFromKey('instr-desc-review')).toBe('review')
    expect(instructionSlugFromKey('instr-task-skills-review')).toBe('review')
    expect(instructionSlugFromKey('api/instr-desc-review')).toBe('review')
  })

  it('strips exactly one leading api prefix', () => {
    expect(stripApiPrefix('api/instr-review')).toBe('instr-review')
    expect(stripApiPrefix('instr-review')).toBe('instr-review')
    expect(stripApiPrefix('api/api/instr-review')).toBe('api/instr-review')
    expect(stripApiPrefix('instr-api/review')).toBe('instr-api/review')
  })
})
