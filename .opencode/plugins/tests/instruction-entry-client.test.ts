import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceClient = vi.hoisted(() => ({ getClient: vi.fn() }))

vi.mock('@plugins/helpers/service-client', () => ({ getClient: serviceClient.getClient }))

import { getClient } from '@plugins/helpers/service-client'

import {
  MAX_ENTRY_VALUE_BYTES,
  writeEntry,
  removeEntry,
  entryValueBytes,
  findEntry,
  isEntryValueCurrent,
  listEntries,
} from '@plugins/helpers/instruction-entry-client'

interface Store {
  entries: Array<{ key: string, value: unknown }>
  list: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

describe('instruction entry client', () => {
  let store: Store

  beforeEach(() => {
    store = {
      entries: [],
      list: vi.fn(async () => store.entries),
      put: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
    }
    serviceClient.getClient.mockResolvedValue({ session: { instructions: { entry: store } } })
  })

  describe('findEntry', () => {
    it('returns the entry when the key is present', async () => {
      store.entries = [{ key: 'a', value: 'x' }, { key: 'b', value: { n: 1 } }]

      await expect(findEntry('ses_1', 'b')).resolves.toEqual({ key: 'b', value: { n: 1 } })
      expect(store.list).toHaveBeenCalledWith({ sessionID: 'ses_1' })
    })

    it('returns undefined when the key is absent', async () => {
      store.entries = [{ key: 'a', value: 'x' }]

      await expect(findEntry('ses_1', 'b')).resolves.toBeUndefined()
    })

    it('propagates a client failure', async () => {
      serviceClient.getClient.mockRejectedValue(new Error('no service'))

      await expect(findEntry('ses_1', 'a')).rejects.toThrow('no service')
    })

    it('finds an entry returned with either key spelling', async () => {
      store.entries = [{ key: 'api/a', value: 'x' }]
      await expect(findEntry('ses_1', 'a')).resolves.toEqual({ key: 'a', value: 'x' })

      store.entries = [{ key: 'a', value: 'x' }]
      await expect(findEntry('ses_1', 'api/a')).resolves.toEqual({ key: 'a', value: 'x' })
    })
  })

  describe('listEntries', () => {
    it('lists an entry returned with the api/ prefix', async () => {
      store.entries = [{ key: 'api/a', value: 'x' }]

      await expect(listEntries('ses_1')).resolves.toEqual([{ key: 'a', value: 'x' }])
    })
  })

  describe('isEntryValueCurrent', () => {
    it('is true when the stored value equals the desired value', () => {
      expect(isEntryValueCurrent({ key: 'k', value: 'BLOCK' }, 'BLOCK')).toBe(true)
      expect(getClient).not.toHaveBeenCalled()
    })

    it('is false when the stored value differs', () => {
      expect(isEntryValueCurrent({ key: 'k', value: 'OLD' }, 'NEW')).toBe(false)
      expect(getClient).not.toHaveBeenCalled()
    })

    it('is false when there is no entry', () => {
      expect(isEntryValueCurrent(undefined, 'BLOCK')).toBe(false)
      expect(getClient).not.toHaveBeenCalled()
    })

    it('keeps workflow.ts string values comparing by identity', () => {
      const block = '<workflow_instructions>body</workflow_instructions>'

      expect(isEntryValueCurrent({ key: 'k', value: block }, block)).toBe(true)
      expect(isEntryValueCurrent({ key: 'k', value: 'other' }, block)).toBe(false)
      expect(isEntryValueCurrent({ key: 'k', value: { n: 1 } }, { text: 't', source: 's', priority: 0 })).toBe(false)
    })

    it('compares object values field-wise instead of by identity', () => {
      const value = { text: 'BLOCK', source: '/a.md', priority: 0 } as const

      expect(isEntryValueCurrent({ key: 'k', value: { ...value } }, value)).toBe(true)
      expect(isEntryValueCurrent({ key: 'k', value: { ...value, priority: 1 } }, value)).toBe(false)
    })
  })

  describe('writeEntry', () => {
    it('returns unchanged without writing when the stored value is identical', async () => {
      store.entries = [{ key: 'k', value: 'BLOCK' }]

      await expect(writeEntry('ses_1', 'k', 'BLOCK')).resolves.toEqual({ status: 'unchanged' })
      expect(store.put).not.toHaveBeenCalled()
    })

    it('returns written after a successful put', async () => {
      store.entries = [{ key: 'k', value: 'OLD' }]

      await expect(writeEntry('ses_1', 'k', 'NEW')).resolves.toEqual({ status: 'written' })
      expect(store.put).toHaveBeenCalledWith({ sessionID: 'ses_1', key: 'k', value: 'NEW' })
    })

    it('writes when no entry exists yet', async () => {
      await expect(writeEntry('ses_1', 'k', 'NEW')).resolves.toEqual({ status: 'written' })
      expect(store.put).toHaveBeenCalledTimes(1)
    })

    it('returns failed with the error and cause when the transport put throws', async () => {
      store.put.mockRejectedValue(new Error('put failed'))

      const result = await writeEntry('ses_1', 'k', 'NEW')

      expect(result).toMatchObject({ status: 'failed', error: 'put failed' })
      expect(result.reason).toBeUndefined()
      expect(result.cause).toBeInstanceOf(Error)
    })

    it('writes an object value once and reports unchanged on an identical re-put', async () => {
      store.put.mockImplementation(async ({ key, value }) => {
        store.entries = [...store.entries.filter(entry => entry.key !== key), { key, value }]
      })

      const value = { text: 'BLOCK', source: '/a.md', priority: 0 } as const

      await expect(writeEntry('ses_1', 'k', value)).resolves.toEqual({ status: 'written' })
      await expect(writeEntry('ses_1', 'k', { ...value })).resolves.toEqual({ status: 'unchanged' })
      expect(store.put).toHaveBeenCalledTimes(1)
    })

    it('re-puts when only priority changes', async () => {
      store.put.mockImplementation(async ({ key, value }) => {
        store.entries = [...store.entries.filter(entry => entry.key !== key), { key, value }]
      })

      const value = { text: 'BLOCK', source: '/a.md', priority: 0 } as const

      await expect(writeEntry('ses_1', 'k', value)).resolves.toEqual({ status: 'written' })
      await expect(writeEntry('ses_1', 'k', { ...value, priority: 1 })).resolves.toEqual({ status: 'written' })
      expect(store.put).toHaveBeenCalledTimes(2)
    })

    it('returns oversize in the result without putting or throwing', async () => {
      const oversized = { text: 'a'.repeat(MAX_ENTRY_VALUE_BYTES), source: '/a.md', priority: 0 } as const

      await expect(writeEntry('ses_1', 'k', oversized)).resolves.toStrictEqual({ status: 'failed', reason: 'oversize' })
      expect(getClient).not.toHaveBeenCalled()
      expect(store.put).not.toHaveBeenCalled()
    })

    it('one list backs N writes', async () => {
      const snapshot = await listEntries('ses_1')

      await expect(writeEntry('ses_1', 'a', 'A', snapshot)).resolves.toEqual({ status: 'written' })
      await expect(writeEntry('ses_1', 'b', 'B', snapshot)).resolves.toEqual({ status: 'written' })
      await expect(writeEntry('ses_1', 'c', 'C', snapshot)).resolves.toEqual({ status: 'written' })

      expect(store.list).toHaveBeenCalledTimes(1)
      expect(store.put).toHaveBeenCalledTimes(3)
    })

    it('strips the api/ prefix before put', async () => {
      await expect(writeEntry('ses_1', 'api/k', 'NEW')).resolves.toEqual({ status: 'written' })
      expect(store.put).toHaveBeenCalledWith({ sessionID: 'ses_1', key: 'k', value: 'NEW' })
    })
  })

  describe('removeEntry', () => {
    it('returns removed after a successful remove', async () => {
      store.entries = [{ key: 'k', value: 'x' }]

      await expect(removeEntry('ses_1', 'k')).resolves.toEqual({ status: 'removed' })
      expect(store.remove).toHaveBeenCalledWith({ sessionID: 'ses_1', key: 'k' })
    })

    it('returns absent without removing when the key is missing', async () => {
      await expect(removeEntry('ses_1', 'k')).resolves.toEqual({ status: 'absent' })
      expect(store.remove).not.toHaveBeenCalled()
    })

    it('returns failed with the error and cause when the transport remove throws', async () => {
      store.entries = [{ key: 'k', value: 'x' }]
      store.remove.mockRejectedValue(new Error('remove failed'))

      const result = await removeEntry('ses_1', 'k')

      expect(result).toMatchObject({ status: 'failed', error: 'remove failed' })
      expect(result.reason).toBeUndefined()
      expect(result.cause).toBeInstanceOf(Error)
    })

    it('strips the api/ prefix before remove', async () => {
      store.entries = [{ key: 'k', value: 'x' }]

      await expect(removeEntry('ses_1', 'api/k')).resolves.toEqual({ status: 'removed' })
      expect(store.remove).toHaveBeenCalledWith({ sessionID: 'ses_1', key: 'k' })
    })

    it('drops the key from a supplied snapshot so a later call sees the removal', async () => {
      store.entries = [{ key: 'k', value: 'x' }, { key: 'other', value: 'y' }]

      const snapshot = await listEntries('ses_1')

      await expect(removeEntry('ses_1', 'k', snapshot)).resolves.toEqual({ status: 'removed' })
      await expect(removeEntry('ses_1', 'k', snapshot)).resolves.toEqual({ status: 'absent' })
      expect(store.list).toHaveBeenCalledTimes(1)
      expect(store.remove).toHaveBeenCalledTimes(1)
    })
  })

  describe('entryValueBytes', () => {
    const cases = [
      { name: 'a string', value: 'abc', expected: 5 },
      { name: 'an object', value: { a: 1 }, expected: 7 },
      { name: 'a multi-byte string', value: 'é', expected: 4 },
    ]

    it.each(cases)('counts the UTF-8 bytes of $name', ({ value, expected }) => {
      expect(entryValueBytes(value)).toBe(expected)
    })

    it('accepts a value exactly at the size limit and reports oversize one byte more', async () => {
      const atLimit = 'a'.repeat(MAX_ENTRY_VALUE_BYTES - 2)

      expect(entryValueBytes(atLimit)).toBe(MAX_ENTRY_VALUE_BYTES)
      await expect(writeEntry('ses_1', 'k', atLimit)).resolves.toEqual({ status: 'written' })

      await expect(writeEntry('ses_1', 'k2', `${atLimit}a`)).resolves.toStrictEqual({ status: 'failed', reason: 'oversize' })
    })
  })
})
