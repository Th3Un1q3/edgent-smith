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

    it('returns failed with the error message when the transport put throws', async () => {
      store.put.mockRejectedValue(new Error('put failed'))

      await expect(writeEntry('ses_1', 'k', 'NEW')).resolves.toStrictEqual({ status: 'failed', error: 'put failed' })
    })

    it('throws when the value exceeds the size limit', async () => {
      const oversized = 'a'.repeat(MAX_ENTRY_VALUE_BYTES)

      await expect(writeEntry('ses_1', 'k', oversized)).rejects.toThrow(`entry k exceeds ${MAX_ENTRY_VALUE_BYTES} bytes`)
      expect(getClient).not.toHaveBeenCalled()
      expect(store.put).not.toHaveBeenCalled()
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

    it('returns failed with the error message when the transport remove throws', async () => {
      store.entries = [{ key: 'k', value: 'x' }]
      store.remove.mockRejectedValue(new Error('remove failed'))

      await expect(removeEntry('ses_1', 'k')).resolves.toStrictEqual({ status: 'failed', error: 'remove failed' })
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

    it('accepts a value exactly at the size limit and rejects one byte more', async () => {
      const atLimit = 'a'.repeat(MAX_ENTRY_VALUE_BYTES - 2)

      expect(entryValueBytes(atLimit)).toBe(MAX_ENTRY_VALUE_BYTES)
      await expect(writeEntry('ses_1', 'k', atLimit)).resolves.toEqual({ status: 'written' })

      await expect(writeEntry('ses_1', 'k2', `${atLimit}a`)).rejects.toThrow(`entry k2 exceeds ${MAX_ENTRY_VALUE_BYTES} bytes`)
    })
  })
})
