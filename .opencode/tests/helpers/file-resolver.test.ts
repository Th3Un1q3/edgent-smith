import { describe, it, expect } from 'vitest'
import { match } from '../../plugins/helpers/file-resolver'

describe('file-resolver match', () => {
  it('returns true when an exact path matches the pattern', () => {
    expect(match('src/index.ts', 'src/index.ts')).toBe(true)
  })

  it('returns false when the path does not match the pattern', () => {
    expect(match('src/**/*.ts', 'src/index.js')).toBe(false)
  })

  it('matches glob patterns recursively', () => {
    expect(match('**/*.py', 'workspace/agents/edge.py')).toBe(true)
    expect(match('**/*.py', 'workspace/agents/utils/base.py')).toBe(true)
  })

  it('matches nested directory patterns', () => {
    expect(match('.github/**/*.md', '.github/instructions/tdd.md')).toBe(true)
    expect(match('.github/**/*.md', '.github/workflows/ci.yml')).toBe(false)
  })

  it('does not match across directory boundaries with single star', () => {
    expect(match('src/*.ts', 'src/nested/index.ts')).toBe(false)
  })
})
