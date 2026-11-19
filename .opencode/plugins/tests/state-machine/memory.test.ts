import { describe, expect, it } from 'vitest'

import {
  EMPTY_MEMORY,
  isMemoryKey,
  isSafeNamespace,
  memoryKey,
  memoryPath,
  parseMemory,
  readMemories,
  skillKey,
} from '@plugins/state-machine/core/memory'

const MARKDOWN = [
  '# Preferences',
  '',
  '## Tone',
  '- be brief',
  '- no preamble',
  '## Scope',
  '- ask before refactors',
].join('\n')

describe('memory keys', () => {
  it('builds a skill completion key and a memory key', () => {
    expect(skillKey('task-delegation')).toBe('skill:task-delegation:complete')
    expect(memoryKey('preferences/user', 'complete')).toBe('mem:preferences/user:complete')
    expect(memoryKey('preferences/user', 'ref')).toBe('mem:preferences/user:ref')
  })

  it('recognises both key families', () => {
    expect(isMemoryKey('mem:a:complete')).toBe(true)
    expect(isMemoryKey('skill:a:complete')).toBe(true)
    expect(isMemoryKey('a lesson')).toBe(false)
  })
})

describe('isSafeNamespace', () => {
  it('accepts a nested namespace', () => {
    expect(isSafeNamespace('preferences/user')).toBe(true)
  })

  it('refuses traversal, absolute paths, backslashes and empty segments', () => {
    expect(isSafeNamespace('../escape')).toBe(false)
    expect(isSafeNamespace('a/../b')).toBe(false)
    expect(isSafeNamespace('/absolute')).toBe(false)
    expect(isSafeNamespace(String.raw`a\b`)).toBe(false)
    expect(isSafeNamespace('a//b')).toBe(false)
    expect(isSafeNamespace('')).toBe(false)
  })
})

describe('memoryPath', () => {
  it('resolves the namespace file under the memory directory', () => {
    expect(memoryPath('/workspace', 'preferences/user')).toBe('/workspace/.serena/memories/preferences/user.md')
  })
})

describe('parseMemory', () => {
  it('takes headings as the index and bullets as the content', () => {
    expect(parseMemory(MARKDOWN)).toEqual({
      index: ['Tone', 'Scope'],
      full: ['be brief', 'no preamble', 'ask before refactors'],
    })
  })

  it('ignores every other line and an empty file', () => {
    expect(parseMemory('# title\nplain text')).toEqual({ index: [], full: [] })
    expect(parseMemory('')).toEqual({ index: [], full: [] })
  })
})

describe('readMemories', () => {
  it('reads one file and parses it', async () => {
    const paths: string[] = []
    const result = await readMemories('/workspace', 'preferences/user', async (path) => {
      paths.push(path)
      return MARKDOWN
    })

    expect(result).toEqual({ ok: true, value: { index: ['Tone', 'Scope'], full: ['be brief', 'no preamble', 'ask before refactors'] } })
    expect(paths).toEqual(['/workspace/.serena/memories/preferences/user.md'])
  })

  it('refuses an unsafe namespace before any read', async () => {
    let reads = 0
    const result = await readMemories('/workspace', '../escape', async () => {
      reads += 1
      return ''
    })

    expect(result.ok).toBe(false)
    expect(reads).toBe(0)
  })

  it('returns the empty value when the file is missing', async () => {
    const result = await readMemories('/workspace', 'preferences/user', async () => {
      throw Object.assign(new Error('nope'), { code: 'ENOENT' })
    })

    expect(result).toEqual({ ok: true, value: EMPTY_MEMORY })
  })

  it('reports an unreadable file without throwing', async () => {
    const result = await readMemories('/workspace', 'preferences/user', async () => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' })
    })

    expect(result.ok).toBe(false)
  })
})
