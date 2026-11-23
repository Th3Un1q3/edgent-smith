import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_TAIL_COUNT,
  MAX_TAIL_TASK_IDS,
  readTailOutputs,
  recordTailOutput,
  TAIL_TTL_MS,
  tailOutputs,
} from '@plugins/workflow/subtask-tail'
import type { SubtaskResult } from '@plugins/workflow/contracts'

const result = (overrides: Partial<SubtaskResult> = {}): SubtaskResult => ({
  outputText: 'hello output',
  task_id: 'task_1',
  status: 'ok',
  durationMs: 100,
  ...overrides,
})

describe('subtask_tail tailOutputs', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty array for an unknown task id', () => {
    expect(tailOutputs(`unknown-${Date.now()}`, {})).toEqual([])
  })

  it('returns the last output recorded for a task id', () => {
    const id = `task-tail-${Date.now()}`
    recordTailOutput(result({ task_id: id, outputText: 'first' }))
    recordTailOutput(result({ task_id: id, outputText: 'second' }))

    const entries = tailOutputs(id, {})

    expect(entries.map(entry => entry.outputText)).toEqual(['first', 'second'])
    expect(entries[0].task_id).toBe(id)
  })

  it('defaults to 3 rows and caps count at 5', () => {
    const id = `task-cap-${Date.now()}`
    for (let index = 0; index < 8; index += 1) {
      recordTailOutput(result({ task_id: id, outputText: `out ${index}` }))
    }

    expect(tailOutputs(id, {})).toHaveLength(3)
    expect(tailOutputs(id, { count: 500 })).toHaveLength(5)
  })

  it('round-trips an output larger than 12KB byte-for-byte', () => {
    const id = `task-large-${Date.now()}`
    const outputText = 'x'.repeat(13 * 1024) + 'TAIL-MARKER'

    recordTailOutput(result({ task_id: id, outputText }))

    const entries = readTailOutputs(id)

    expect(entries).toHaveLength(1)
    expect(entries[0].outputText).toHaveLength(outputText.length)
    expect(entries[0].outputText).toBe(outputText)
    expect(entries[0].outputText.endsWith('TAIL-MARKER')).toBe(true)
  })

  it('exposes status metadata on each entry', () => {
    const id = `task-meta-${Date.now()}`
    recordTailOutput(result({ task_id: id, status: 'error', outputText: 'boom' }))

    const entries = tailOutputs(id, {})

    expect(entries[0]).toMatchObject({ task_id: id, status: 'error' })
  })
})

describe('subtask_tail expiry', () => {
  const base = 1_700_000_000_000

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(base)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('drops an entry older than the TTL', () => {
    const id = 'task-ttl-drop'
    recordTailOutput(result({ task_id: id }))

    vi.setSystemTime(base + TAIL_TTL_MS + 1)

    expect(readTailOutputs(id)).toEqual([])
  })

  it('keeps an entry at exactly the TTL boundary', () => {
    const id = 'task-ttl-edge'
    recordTailOutput(result({ task_id: id }))

    vi.setSystemTime(base + TAIL_TTL_MS)

    expect(readTailOutputs(id)).toHaveLength(1)
  })

  it('applies expiry on read and returns only live entries', () => {
    const id = 'task-ttl-mixed'
    recordTailOutput(result({ task_id: id, outputText: 'stale' }))
    vi.setSystemTime(base + TAIL_TTL_MS / 2)
    recordTailOutput(result({ task_id: id, outputText: 'fresh' }))
    vi.setSystemTime(base + TAIL_TTL_MS + 1)

    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(['fresh'])
  })

  it('hides a purged entry from later reads and keeps new writes clean', () => {
    const id = 'task-ttl-purge'
    recordTailOutput(result({ task_id: id, outputText: 'stale' }))
    vi.setSystemTime(base + TAIL_TTL_MS + 1)

    expect(readTailOutputs(id)).toEqual([])
    expect(readTailOutputs(id)).toEqual([])

    recordTailOutput(result({ task_id: id, outputText: 'fresh' }))

    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(['fresh'])
  })

  it('keeps the fresh entry across repeated reads of a mixed-expiry task', () => {
    const id = 'task-ttl-mixed-purge'
    recordTailOutput(result({ task_id: id, outputText: 'stale' }))
    vi.setSystemTime(base + TAIL_TTL_MS + 1)
    recordTailOutput(result({ task_id: id, outputText: 'fresh' }))

    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(['fresh'])
    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(['fresh'])

    vi.setSystemTime(base + TAIL_TTL_MS + 1 + TAIL_TTL_MS / 2)
    recordTailOutput(result({ task_id: id, outputText: 'after' }))
    vi.setSystemTime(base + 2 * TAIL_TTL_MS + 2)

    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(['after'])
    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(['after'])
  })

  it('prunes an expired row on write instead of letting it hold a cap slot', () => {
    const id = 'task-ttl-prune-on-write'
    const fresh = Array.from({ length: MAX_TAIL_COUNT }, (_, index) => `out ${index}`)
    recordTailOutput(result({ task_id: id, outputText: 'stale' }))
    vi.setSystemTime(base + TAIL_TTL_MS + 1)
    for (const outputText of fresh) recordTailOutput(result({ task_id: id, outputText }))

    expect(readTailOutputs(id)).toHaveLength(MAX_TAIL_COUNT)
    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(fresh)
    expect(readTailOutputs(id).map(entry => entry.outputText)).toEqual(fresh)
  })
})

describe('subtask_tail task_id guard', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('ignores a non-string task_id without throwing', () => {
    const id = 42 as unknown as string

    recordTailOutput(result({ task_id: id, outputText: 'ignored' }))

    expect(readTailOutputs(id)).toEqual([])
  })

  it('ignores an empty task_id without throwing', () => {
    recordTailOutput(result({ task_id: '', outputText: 'ignored' }))

    expect(readTailOutputs('')).toEqual([])
  })
})

describe('subtask_tail stores output whole', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('round-trips an output of exactly 12,288 characters', () => {
    const id = `task-exact-${Date.now()}`
    const outputText = 'x'.repeat(12_288)

    recordTailOutput(result({ task_id: id, outputText }))

    const [entry] = readTailOutputs(id)

    expect(entry.outputText).toHaveLength(12_288)
    expect(entry.outputText).toBe(outputText)
  })

  it('round-trips an output of 12,289 characters without dropping the last character', () => {
    const id = `task-over-${Date.now()}`
    const outputText = 'x'.repeat(12_288) + 'Z'

    recordTailOutput(result({ task_id: id, outputText }))

    const [entry] = readTailOutputs(id)

    expect(entry.outputText).toHaveLength(12_289)
    expect(entry.outputText).toBe(outputText)
    expect(entry.outputText.endsWith('Z')).toBe(true)
  })

  it('has no truncated field on a stored entry', () => {
    const id = `task-no-flag-${Date.now()}`

    recordTailOutput(result({ task_id: id, outputText: 'x'.repeat(13 * 1024) }))

    const [entry] = readTailOutputs(id)

    expect(Object.hasOwn(entry, 'truncated')).toBe(false)
  })
})

describe('subtask_tail storage bounds', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('keeps only the newest entries for one task id', () => {
    const id = `task-entry-cap-${Date.now()}`
    for (let index = 0; index < 6; index += 1) {
      recordTailOutput(result({ task_id: id, outputText: `out ${index}` }))
    }

    const entries = readTailOutputs(id)

    expect(entries).toHaveLength(5)
    expect(entries.map(entry => entry.outputText)).toEqual(['out 1', 'out 2', 'out 3', 'out 4', 'out 5'])
  })

  it('keeps every id while the store sits at the cap', () => {
    const stamp = Date.now()
    const last = `evict-at-cap-${stamp}-${MAX_TAIL_TASK_IDS - 1}`
    const ids = Array.from({ length: MAX_TAIL_TASK_IDS }, (_, index) => `evict-at-cap-${stamp}-${index}`)
    for (const id of ids) recordTailOutput(result({ task_id: id }))

    expect(readTailOutputs(ids[0])).toHaveLength(1)
    expect(readTailOutputs(last)).toHaveLength(1)
  })

  it('evicts the oldest ids once the store passes the cap', () => {
    const stamp = Date.now()
    const last = `evict-over-cap-${stamp}-${MAX_TAIL_TASK_IDS}`
    const ids = Array.from({ length: MAX_TAIL_TASK_IDS + 1 }, (_, index) => `evict-over-cap-${stamp}-${index}`)
    for (const id of ids) recordTailOutput(result({ task_id: id }))

    expect(readTailOutputs(ids[0])).toEqual([])
    expect(readTailOutputs(ids[1])).toHaveLength(1)
    expect(readTailOutputs(last)).toHaveLength(1)
  })
})
