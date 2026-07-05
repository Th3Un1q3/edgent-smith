import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  keySelector,
  readState,
  SESSION_FIELDS,
  updateState,
} from '../../plugins/helpers/kv-store'

describe('keySelector', () => {
  it('selects a nested value by key path', () => {
    const selector = keySelector(['a', 'b'])
    expect(selector({ a: { b: 42, c: 'ignore' } })).toBe(42)
  })

  it('returns undefined when a key is missing', () => {
    const selector = keySelector(['a', 'b'])
    expect(selector({})).toBeUndefined()
  })

  it('returns undefined when the path traverses a non-object value', () => {
    const selector = keySelector(['a', 'b'])
    expect(selector({ a: null })).toBeUndefined()
    expect(selector({ a: 'string' })).toBeUndefined()
  })
})

describe('session state helpers', () => {
  const withTempDir = (test: (dir: string) => void) => {
    const originalCwd = process.cwd()
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-store-'))
    process.chdir(tempDir)
    try {
      test(tempDir)
    } finally {
      process.chdir(originalCwd)
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  }

  it('writes and reads a fresh session state', () => {
    withTempDir(() => {
      const sessionId = 'ses-test-001'
      const written = updateState(sessionId, () => ({ startedAt: 'now', count: 1 }))
      expect(written).toEqual({ startedAt: 'now', count: 1 })

      const count = readState(sessionId, keySelector(['count']))
      expect(count).toBe(1)
    })
  })

  it('updates an existing session state', () => {
    withTempDir(() => {
      const sessionId = 'ses-test-002'
      updateState<{ count: number }>(sessionId, () => ({ count: 1 }))
      const next = updateState<{ count: number }>(sessionId, (state) => ({
        ...state,
        count: state.count + 1,
      }))

      expect(next.count).toBe(2)
      expect(readState(sessionId, keySelector(['count']))).toBe(2)
    })
  })

  it('returns undefined when reading a missing session', () => {
    withTempDir(() => {
      expect(readState('does-not-exist', keySelector(['count']))).toBeUndefined()
    })
  })
})

describe('SESSION_FIELDS', () => {
  it('contains the expected session keys', () => {
    expect(SESSION_FIELDS.startedAt).toBe('startedAt')
    expect(SESSION_FIELDS.lastMessageSentAt).toBe('lastMessageSentAt')
    expect(SESSION_FIELDS.toolCalls).toBe('toolCalls')
  })
})
