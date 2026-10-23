import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InstructionCarrierUnavailableError,
  publishInstructionSet,
  resolveInjectionCarrier,
} from '@plugins/helpers/instruction-carrier'
import type {
  CarrierStorage,
  EntryFailureReason,
  InstructionEntryDraft,
  LoaderOutcome,
  PublishRequest,
} from '@plugins/helpers/instruction-carrier'
import type { EntryResult, EntryStatus } from '@plugins/helpers/instruction-entry-client'

const client = vi.hoisted(() => ({
  writeEntry: vi.fn(),
  removeEntry: vi.fn(),
}))

vi.mock('@plugins/helpers/instruction-entry-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/helpers/instruction-entry-client')>()
  return { ...actual, writeEntry: client.writeEntry, removeEntry: client.removeEntry }
})

const LEDGER_KEY = 'instruction-carrier/ses_test.unpublished'

interface MemoryStorage extends CarrierStorage {
  readonly values: Map<string, unknown>
}

const createStorage = (): MemoryStorage => {
  const values = new Map<string, unknown>()
  return {
    values,
    get: key => values.get(key),
    set: (key, value) => { values.set(key, value) },
    remove: (key) => { values.delete(key) },
  }
}

const draft = (index: number): InstructionEntryDraft => ({
  identity: `/workspace/.opencode/instructions/id-${index}.instructions.md`,
  key: `instr-id-${index}`,
  value: { text: `text-${index}`, source: `source-${index}`, priority: 0 },
})

const referenceOf = (index: number): NonNullable<InstructionEntryDraft['reference']> => ({
  key: `instr-ref-id-${index}`,
  value: { text: `ref-text-${index}`, source: `source-${index}`, priority: 1 },
})

const publish = (
  storage: CarrierStorage,
  entries: readonly InstructionEntryDraft[],
  removals: readonly string[] = [],
): Promise<ReturnType<typeof publishInstructionSet> extends Promise<infer R> ? R : never> =>
  publishInstructionSet({
    sessionID: 'ses_test',
    directory: '/workspace',
    entries,
    removals,
    snapshot: [],
    storage,
  } satisfies PublishRequest)

const failed = (cause: unknown, reason?: EntryFailureReason): EntryResult =>
  reason === undefined ? { status: 'failed', cause } : { status: 'failed', cause, reason }

const emitted: string[] = []

beforeEach(() => {
  emitted.length = 0
  vi.spyOn(process, 'emitWarning').mockImplementation((warning) => {
    emitted.push(String(warning))
  })
  client.writeEntry.mockReset()
  client.removeEntry.mockReset()
  client.removeEntry.mockResolvedValue({ status: 'absent' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('resolveInjectionCarrier', () => {
  it('loader outcomes and entry statuses do not overlap', () => {
    type Overlap = Extract<LoaderOutcome, EntryStatus>
    const disjoint: [Overlap] extends [never] ? true : false = true

    expect(disjoint).toBe(true)
  })

  it('defaults to native when the flag is unset or empty', () => {
    expect(resolveInjectionCarrier({}, 'build')).toBe('native')
    expect(resolveInjectionCarrier({ INSTRUCTION_INJECTION: '' }, 'build')).toBe('native')
  })

  it('reads the flag on every call', () => {
    expect(resolveInjectionCarrier({ INSTRUCTION_INJECTION: 'synthetic' }, 'build')).toBe('synthetic')
    expect(resolveInjectionCarrier({ INSTRUCTION_INJECTION: 'native' }, 'build')).toBe('native')
    expect(resolveInjectionCarrier({}, 'build')).toBe('native')
  })

  it('warns once per distinct rejected value and always resolves to native', () => {
    expect(resolveInjectionCarrier({ INSTRUCTION_INJECTION: 'mystery-a' }, 'build')).toBe('native')
    expect(resolveInjectionCarrier({ INSTRUCTION_INJECTION: 'mystery-a' }, 'build')).toBe('native')
    expect(emitted.filter(message => message.includes('mystery-a'))).toHaveLength(1)

    expect(resolveInjectionCarrier({ INSTRUCTION_INJECTION: 'mystery-b' }, 'build')).toBe('native')
    expect(emitted.filter(message => message.includes('mystery-b'))).toHaveLength(1)
  })
})

describe('publishInstructionSet', () => {
  it('records unpublished identities and republishes them at the next touch', async () => {
    const storage = createStorage()
    const first = draft(1)
    const second = draft(2)
    const third = draft(3)

    client.writeEntry
      .mockResolvedValueOnce({ status: 'written' })
      .mockResolvedValueOnce(failed(new Error('boom')))
      .mockResolvedValueOnce({ status: 'written' })
      .mockResolvedValueOnce({ status: 'written' })

    const degraded = await publish(storage, [first, second])

    expect(degraded.outcome).toBe('degraded')
    expect(storage.values.get(LEDGER_KEY)).toEqual({
      version: 1,
      entries: [{ identity: second.identity, key: second.key, value: second.value }],
    })

    const republished = await publish(storage, [third])

    expect(republished.outcome).toBe('published')
    expect(client.writeEntry.mock.calls.map(call => call[1])).toEqual([
      first.key,
      second.key,
      second.key,
      third.key,
    ])
    expect(storage.values.has(LEDGER_KEY)).toBe(false)
  })

  it('the unpublished ledger evicts the oldest identity at the cap', async () => {
    const storage = createStorage()
    const drafts = Array.from({ length: 18 }, (_, index) => draft(index + 1))

    client.writeEntry.mockResolvedValueOnce({ status: 'written' })
    client.writeEntry.mockResolvedValue(failed(new Error('boom')))

    const result = await publish(storage, drafts)
    const ledger = storage.values.get(LEDGER_KEY) as { entries: Array<{ identity: string }> }

    expect(result.outcome).toBe('degraded')
    expect(ledger.entries).toHaveLength(16)
    expect(ledger.entries[0]?.identity).toBe(drafts[2]?.identity)
    expect(ledger.entries.at(-1)?.identity).toBe(drafts.at(-1)?.identity)
  })

  it('drops a single ledger entry larger than the cap and warns once', async () => {
    const storage = createStorage()
    const seed = draft(1)
    const huge: InstructionEntryDraft = {
      identity: draft(2).identity,
      key: draft(2).key,
      value: { text: 'x'.repeat(100 * 1024), source: 'huge', priority: 0 },
    }

    client.writeEntry.mockResolvedValueOnce({ status: 'written' })
    client.writeEntry.mockResolvedValue(failed(new Error('boom')))

    await publish(storage, [seed, huge])
    await publish(storage, [seed, huge])

    expect(storage.values.has(LEDGER_KEY)).toBe(false)
    expect(emitted.filter(message => message.includes('ledger entry'))).toHaveLength(1)
  })

  it('an emptied ledger removes the storage key', async () => {
    const storage = createStorage()
    const entry = draft(1)
    storage.set(LEDGER_KEY, { version: 1, entries: [{ ...entry }] })
    client.writeEntry.mockResolvedValue({ status: 'unchanged' })

    const result = await publish(storage, [])

    expect(result.outcome).toBe('published')
    expect(result.published).toEqual([entry.identity])
    expect(storage.values.has(LEDGER_KEY)).toBe(false)
  })

  it('assigns one loader outcome per touch', async () => {
    const cases: ReadonlyArray<readonly [string, EntryResult[], LoaderOutcome]> = [
      ['fallback', [failed(new InstructionCarrierUnavailableError('method-absent'))], 'fallback'],
      ['degraded', [
        { status: 'written' },
        failed(new InstructionCarrierUnavailableError('transport')),
      ], 'degraded'],
      ['skipped', [failed(new Error('boom'))], 'skipped'],
      ['published', [{ status: 'written' }], 'published'],
    ]

    for (const [name, results, expected] of cases) {
      client.writeEntry.mockReset()
      for (const result of results) client.writeEntry.mockResolvedValueOnce(result)

      const result = await publish(createStorage(), [draft(1), draft(2)].slice(0, results.length))

      expect(`${name}:${result.outcome}`).toBe(`${name}:${expected}`)
      const matches = [
        result.outcome === 'fallback',
        result.outcome === 'degraded',
        result.outcome === 'skipped',
        result.outcome === 'published',
      ].filter(Boolean)
      expect(matches).toHaveLength(1)
    }
  })

  it('a row-9 failure after the first write is degraded, not skipped', async () => {
    client.writeEntry
      .mockResolvedValueOnce({ status: 'written' })
      .mockResolvedValueOnce(failed(new Error('boom')))

    const result = await publish(createStorage(), [draft(1), draft(2)])

    expect(result.outcome).toBe('degraded')
    expect(result.statuses[1]).toMatchObject({ status: 'skipped', reason: 'unknown' })
  })

  it('a client without the entry method falls back', async () => {
    client.writeEntry.mockResolvedValue(failed(new InstructionCarrierUnavailableError('method-absent')))

    const result = await publish(createStorage(), [draft(1)])

    expect(result.outcome).toBe('fallback')
    expect(result.published).toEqual([])
    expect(client.removeEntry).not.toHaveBeenCalled()
  })

  it('an unclassifiable failure skips the turn without a fallback', async () => {
    client.writeEntry.mockResolvedValue(failed(new Error('boom')))

    const result = await publish(createStorage(), [draft(1)])

    expect(result.outcome).toBe('skipped')
    expect(result.statuses[0]).toMatchObject({ status: 'skipped', reason: 'unknown' })
    expect(client.removeEntry).not.toHaveBeenCalled()
  })

  it('a stored ledger without an entries array is ignored', async () => {
    const storage = createStorage()
    storage.set(LEDGER_KEY, { version: 1, entries: 'not-an-array' })
    client.writeEntry.mockResolvedValue({ status: 'written' })

    const result = await publish(storage, [draft(1)])

    expect(result.published).toEqual([draft(1).identity])
    expect(storage.values.has(LEDGER_KEY)).toBe(false)
  })

  it('drops stored ledger rows that are not ledger entries', async () => {
    const storage = createStorage()
    storage.set(LEDGER_KEY, {
      version: 1,
      entries: [null, { identity: 'bad-value', key: 'instr-bad-value', value: 5 }],
    })
    client.writeEntry.mockResolvedValue({ status: 'written' })

    const result = await publish(storage, [draft(1)])

    expect(result.published).toEqual([draft(1).identity])
    expect(client.writeEntry).toHaveBeenCalledTimes(1)
  })

  it('a failed write with an explicit reason warns with its error detail and falls back', async () => {
    const storage = createStorage()
    storage.set('instruction-carrier/ses_test', { version: 1 })
    client.writeEntry.mockResolvedValue({
      status: 'failed',
      cause: new Error('boom'),
      reason: 'transport',
      error: 'socket closed',
    })

    const result = await publish(storage, [draft(1)])

    expect(result.outcome).toBe('fallback')
    expect(result.statuses[0]).toMatchObject({ status: 'failed', reason: 'transport' })
    expect(emitted.some(message => message.includes('socket closed'))).toBe(true)
    expect(storage.values.get('instruction-carrier/ses_test')).toEqual({ version: 1, reasons: ['transport'] })
  })

  it('a server-side oversize rejection writes the reference entry instead of skipping', async () => {
    const original: InstructionEntryDraft = { ...draft(1), reference: referenceOf(1) }
    client.writeEntry
      .mockResolvedValueOnce({ status: 'failed', reason: 'oversize' })
      .mockResolvedValueOnce({ status: 'written' })

    const result = await publish(createStorage(), [original])

    expect(client.writeEntry.mock.calls.map(call => call[1])).toEqual([original.key, referenceOf(1).key])
    expect(result.outcome).toBe('published')
    expect(result.statuses[0]).toMatchObject({ identity: original.identity, status: 'written' })
    expect(result.published).toEqual([original.identity])
    expect(client.removeEntry.mock.calls.map(call => call[1])).toContain(original.key)
    expect(emitted.some(message => message.includes(`wrote reference ${referenceOf(1).key}`))).toBe(true)
  })

  it('a touch whose only candidate is oversize stays published', async () => {
    client.writeEntry.mockResolvedValue({ status: 'failed', reason: 'oversize' })

    const result = await publish(createStorage(), [draft(1)])

    expect(result.outcome).toBe('published')
    expect(result.statuses[0]).toMatchObject({ status: 'failed', reason: 'oversize' })
    expect(client.writeEntry).toHaveBeenCalledTimes(1)
    expect(client.removeEntry).not.toHaveBeenCalled()
    expect(emitted.some(message => message.includes('entry value cap; skipped'))).toBe(true)
  })

  it('a reference draft rejected as oversize is skipped without failing the touch', async () => {
    const original: InstructionEntryDraft = { ...draft(1), reference: referenceOf(1) }
    client.writeEntry
      .mockResolvedValueOnce({ status: 'failed', reason: 'oversize' })
      .mockResolvedValueOnce({ status: 'failed', reason: 'oversize' })

    const result = await publish(createStorage(), [original])

    expect(result.outcome).toBe('published')
    expect(result.statuses[0]).toMatchObject({ status: 'skipped', reason: 'oversize' })
    expect(client.removeEntry).not.toHaveBeenCalled()
    expect(emitted.some(message => message.includes(`reference ${referenceOf(1).key} was not written; skipped`))).toBe(true)
  })

  it('a write that returns absent skips the turn', async () => {
    client.writeEntry.mockResolvedValue({ status: 'absent' })

    const result = await publish(createStorage(), [draft(1), draft(2)])

    expect(result.outcome).toBe('skipped')
    expect(result.statuses[0]).toMatchObject({ status: 'skipped' })
    expect(client.writeEntry).toHaveBeenCalledTimes(1)
  })

  it('a replayed ledger identity that fails again is recorded once', async () => {
    const storage = createStorage()
    const settled = draft(1)
    const replayed = draft(2)
    const fresh = draft(3)
    storage.set(LEDGER_KEY, { version: 1, entries: [{ ...settled }, { ...replayed }] })
    client.writeEntry
      .mockResolvedValueOnce({ status: 'written' })
      .mockResolvedValueOnce(failed(new Error('boom')))

    const result = await publish(storage, [replayed, fresh])

    expect(result.outcome).toBe('degraded')
    const ledger = storage.values.get(LEDGER_KEY) as { entries: Array<{ identity: string }> }
    expect(ledger.entries.map(entry => entry.identity)).toEqual([replayed.identity, fresh.identity])
  })

  it('a failed removal warns once', async () => {
    const storage = createStorage()
    client.writeEntry.mockResolvedValue({ status: 'written' })
    client.removeEntry.mockResolvedValue(failed(new Error('boom')))

    const result = await publish(storage, [draft(1)], ['instr-gone'])

    expect(result.outcome).toBe('published')
    expect(emitted.some(message => message.includes('removal of instr-gone failed (unknown)'))).toBe(true)
  })

  it('a request without storage keeps its ledger in process memory', async () => {
    const sessionID = 'ses_memory_ledger'
    client.writeEntry
      .mockResolvedValueOnce({ status: 'written' })
      .mockResolvedValueOnce(failed(new Error('boom')))

    const first = await publishInstructionSet({
      sessionID,
      directory: '/workspace',
      entries: [draft(1), draft(2)],
      removals: [],
      snapshot: [],
    })

    client.writeEntry.mockResolvedValue({ status: 'written' })

    const second = await publishInstructionSet({
      sessionID,
      directory: '/workspace',
      entries: [draft(3)],
      removals: [],
      snapshot: [],
    })

    expect(first.outcome).toBe('degraded')
    expect(second.outcome).toBe('published')
    expect(client.writeEntry.mock.calls.map(call => call[1])).toEqual([
      draft(1).key,
      draft(2).key,
      draft(2).key,
      draft(3).key,
    ])
  })
})
