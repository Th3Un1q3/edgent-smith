import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadCopilotInstructions } from '../../plugins/harness-plugin'
import { createOpencodeClientMock } from '../factories/opencode-client'

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-plugin-'))
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})

const writeInstructionFile = (relativePath: string, content: string): string => {
  const filePath = path.join(tempDir, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content)
  return filePath
}

describe('loadCopilotInstructions', () => {
  it('loads instructions matching the default pattern', async () => {
    const filePath = writeInstructionFile(
      '.github/instructions/style.instructions.md',
      `---\ndescription: Style guide\napplyTo: '**/*.ts'\n---\nUse strict types.`,
    )

    const instructions = await loadCopilotInstructions(tempDir, ['**/*.instructions.md'], createOpencodeClientMock({ app: { log: vi.fn() } }))

    expect(instructions).toHaveLength(1)
    expect(instructions[0].path).toBe(filePath)
    expect(instructions[0].frontMatter.description).toBe('Style guide')
    expect(instructions[0].content).toBe('Use strict types.')
  })

  it('loads instructions matching a custom pattern', async () => {
    const filePath = writeInstructionFile(
      'docs/rules.md',
      `---\ndescription: Docs rule\napplyTo: '**/*.md'\n---\nKeep headers short.`,
    )

    const instructions = await loadCopilotInstructions(tempDir, ['docs/rules.md', '**/*.instructions.md'], createOpencodeClientMock({ app: { log: vi.fn() } }))

    expect(instructions).toHaveLength(1)
    expect(instructions[0].path).toBe(filePath)
    expect(instructions[0].frontMatter.description).toBe('Docs rule')
  })

  it('deduplicates when overlapping patterns match the same file', async () => {
    const filePath = writeInstructionFile(
      '.github/instructions/overlap.instructions.md',
      `---\ndescription: Overlap\napplyTo: '*'\n---\nOnly once.`,
    )

    const instructions = await loadCopilotInstructions(tempDir, ['**/*.instructions.md', '.github/**/*.md'], createOpencodeClientMock({ app: { log: vi.fn() } }))

    expect(instructions).toHaveLength(1)
    expect(instructions[0].path).toBe(filePath)
  })

  it('merges instructions from multiple non-overlapping patterns', async () => {
    const instructionsPath = writeInstructionFile(
      '.github/instructions/style.instructions.md',
      `---\ndescription: Style guide\napplyTo: '**/*.ts'\n---\nUse strict types.`,
    )
    const rulesPath = writeInstructionFile(
      'docs/rules.md',
      `---\ndescription: Docs rule\napplyTo: '**/*.md'\n---\nKeep headers short.`,
    )

    const instructions = await loadCopilotInstructions(tempDir, ['**/*.instructions.md', 'docs/rules.md'], createOpencodeClientMock({ app: { log: vi.fn() } }))

    const paths = instructions.map(i => i.path)
    expect(paths).toContain(instructionsPath)
    expect(paths).toContain(rulesPath)
    expect(instructions).toHaveLength(2)
  })
})
