import { describe, expect, it, vi } from 'vitest'

import { InstructionContextHelper } from '@plugins/helpers/instruction-context-helper'

import { makeMockIndexer, createIndexerFactory } from '@tests/helpers/mock-utilities'

const makeHelper = (
  metas: Array<{ description: string, path: string, applyTo: string }>,
  bodyMap?: Record<string, string>,
) => new InstructionContextHelper({ indexerFactory: createIndexerFactory(makeMockIndexer(metas, bodyMap)) })

describe('InstructionContextHelper', () => {
  describe('prioritization by glob specificity', () => {
    const cases = [
      {
        name: 'most specific glob first (src/**/*.ts > **/*.ts > **/*.{ts,js})',
        metas: [
          { description: 'global ts files', path: '/a.global.instructions.md', applyTo: '**/*.{ts,js}' },
          { description: 'all ts files', path: '/b.all-ts.instructions.md', applyTo: '**/*.ts' },
          { description: 'src ts files', path: '/c.src-ts.instructions.md', applyTo: 'src/**/*.ts' },
        ],
        expected: ['src ts files', 'all ts files', 'global ts files'],
      },
      {
        name: 'alphabetical tiebreak when specificity is tied',
        metas: [
          { description: 'zebra glob', path: '/a.zebra.instructions.md', applyTo: '**/*.ts' },
          { description: 'alpha glob', path: '/b.alpha.instructions.md', applyTo: '**/*.js' },
        ],
        expected: ['alpha glob', 'zebra glob'],
      },
      {
        name: 'glob with only wildcards has zero specificity — alphabetical tiebreak',
        metas: [
          { description: 'zebra wildcard', path: '/a.wildcard.instructions.md', applyTo: '*' },
          { description: 'alpha wildcard-slash', path: '/b.wildslash.instructions.md', applyTo: '*/' },
        ],
        expected: ['alpha wildcard-slash', 'zebra wildcard'],
      },
    ]

    it.each(cases)('$name', async ({ metas, expected }) => {
      const helper = makeHelper(metas)

      const result = await helper.resolveInstructions(['src/dir/file.ts'])

      expect(result.map(r => r.description)).toEqual(expected)
    })
  })

  describe('body loading', () => {
    it('populates content and idempotencyKey for each instruction', async () => {
      const helper = makeHelper(
        [
          { description: 'instruction a', path: '/a.instructions.md', applyTo: '**/*.ts' },
          { description: 'instruction b', path: '/b.instructions.md', applyTo: '**/*.js' },
        ],
        {
          '/a.instructions.md': '# This is instruction A\n\nSome detailed text.',
          '/b.instructions.md': '# This is instruction B\n\nMore details here.',
        },
      )

      const result = await helper.resolveInstructions(['src/dir/file.ts'])

      expect(result.length).toBe(2)
      expect(result[0].content).toBe('# This is instruction A\n\nSome detailed text.')
      expect(result[1].content).toBe('# This is instruction B\n\nMore details here.')
      expect(result[0].idempotencyKey).toBe('instruction_load:/a.instructions.md')
      expect(result[1].idempotencyKey).toBe('instruction_load:/b.instructions.md')
    })

    it('returns all instructions regardless of body size', async () => {
      const helper = makeHelper(
        [
          { description: 'tiny', path: '/a.tiny.instructions.md', applyTo: '**/*.ts' },
          { description: 'huge', path: '/b.huge.instructions.md', applyTo: '**/*.js' },
        ],
        { '/a.tiny.instructions.md': 'x'.repeat(50), '/b.huge.instructions.md': 'y'.repeat(5000) },
      )

      const result = await helper.resolveInstructions(['src/dir/file.ts'])

      expect(result.length).toBe(2)

      const byDesc = Object.fromEntries(result.map(r => [r.description, r])) as Record<string, { content: string }>

      expect(byDesc.tiny.content).toBe('x'.repeat(50))
      expect(byDesc.huge.content).toBe('y'.repeat(5000))
    })
  })

  describe('empty and edge cases', () => {
    it('returns empty array when filePaths is empty', async () => {
      const helper = makeHelper([])

      expect(await helper.resolveInstructions([])).toEqual([])
    })

    it('returns empty array when no instructions match the files', async () => {
      const helper = makeHelper([])

      expect(await helper.resolveInstructions(['src/dir/file.ts'])).toEqual([])
    })

    it('never calls indexerFactory when filePaths is empty — early return', async () => {
      const indexerFactory = vi.fn()

      const helper = new InstructionContextHelper({ indexerFactory })

      const result = await helper.resolveInstructions([])

      expect(result).toEqual([])
      expect(indexerFactory).not.toHaveBeenCalled()
    })

    it('never calls loadBody or sort when forFiles returns no matches — early return', async () => {
      const loadBody = vi.fn()

      const forFiles = vi.fn().mockResolvedValue([])

      const indexerFactory = vi.fn().mockResolvedValue({ forFiles, loadBody })

      const sortSpy = vi.spyOn(Array.prototype, 'sort')

      const sortCallsBefore = sortSpy.mock.calls.length

      try {
        const helper = new InstructionContextHelper({ indexerFactory })

        const result = await helper.resolveInstructions(['src/dir/file.ts'])

        expect(result).toEqual([])
        expect(indexerFactory).toHaveBeenCalledOnce()
        expect(loadBody).not.toHaveBeenCalled()
        expect(sortSpy.mock.calls.length).toBe(sortCallsBefore)
      }
      finally {
        sortSpy.mockRestore()
      }
    })
  })

  describe('specificity edge patterns', () => {
    it('deeply nested literal path has highest specificity over glob patterns', async () => {
      const helper = makeHelper([
        { description: 'global ts', path: '/a.global.instructions.md', applyTo: '**/*.ts' },
        { description: 'src helper', path: '/b.src-helper.instructions.md', applyTo: 'src/app/utils/helper.ts' },
        { description: 'all ts', path: '/c.all-ts.instructions.md', applyTo: 'src/**/*.ts' },
      ])

      const result = await helper.resolveInstructions(['src/app/utils/helper.ts'])

      expect(result[0].description).toBe('src helper')
    })

    it('trailing slash creates empty segment — equal specificity to no trailing slash', async () => {
      const helper = makeHelper([
        { description: 'zebra-a-b-slash', path: '/a.ab-slash.instructions.md', applyTo: 'a/b/' },
        { description: 'alpha-a-b', path: '/b.ab-noSlash.instructions.md', applyTo: 'a/b' },
      ])

      const result = await helper.resolveInstructions(['src/dir/file.ts'])

      expect(result.length).toBe(2)
      expect(result[0].description).toBe('alpha-a-b')
      expect(result[1].description).toBe('zebra-a-b-slash')
    })
  })
})
