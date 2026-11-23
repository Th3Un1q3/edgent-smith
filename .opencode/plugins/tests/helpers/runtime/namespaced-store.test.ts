import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { namespacedStore } from '@plugins/helpers/runtime/namespaced-store'

type Backend = Parameters<typeof namespacedStore>[0]

const SESSION_ID = 'ses_test'
const PREFIX = 'gates/'
const KEY = PREFIX + SESSION_ID

const keysOf = (data: Map<string, unknown>): string[] => Object.keys(Object.fromEntries(data))

const memoryBackend = (data: Map<string, unknown>): Backend => ({
  get: (key: string) => Effect.sync(() => data.get(key)),
  set: (key: string, value: unknown) => Effect.sync(() => {
    data.set(key, value)
  }),
  remove: (key: string) => Effect.sync(() => {
    data.delete(key)
  }),
  scan: (options: { prefix: string, after?: string }) => Effect.sync(() => ({
    entries: keysOf(data)
      .filter(key => key.startsWith(options.prefix))
      .map(key => ({ key })),
    next: undefined,
  })),
} as unknown as Backend)

const decodeStrings = (value: unknown): readonly string[] =>
  Array.isArray(value) ? value.filter(entry => typeof entry === 'string') : []

const storeOver = (data: Map<string, unknown>) =>
  namespacedStore(memoryBackend(data), PREFIX, decodeStrings)

describe('namespacedStore', () => {
  it('builds the key from the prefix and the session id', () => {
    const data = new Map<string, unknown>()
    Effect.runSync(storeOver(data).write(SESSION_ID, ['alpha']))
    expect(keysOf(data)).toEqual([KEY])
  })

  it('reads and decodes a stored value', () => {
    const data = new Map<string, unknown>([[KEY, ['alpha', 'beta']]])
    expect(Effect.runSync(storeOver(data).read(SESSION_ID))).toEqual(['alpha', 'beta'])
  })

  it('passes an absent value to the decoder as undefined', () => {
    const data = new Map<string, unknown>()
    const seen: unknown[] = []
    const store = namespacedStore(memoryBackend(data), PREFIX, (value) => {
      seen.push(value)
      return decodeStrings(value)
    })
    expect(Effect.runSync(store.read(SESSION_ID))).toEqual([])
    expect(seen).toEqual([undefined])
  })

  it('writes the value under the namespaced key unchanged', () => {
    const data = new Map<string, unknown>()
    Effect.runSync(storeOver(data).write(SESSION_ID, ['alpha']))
    expect(data.get(KEY)).toEqual(['alpha'])
  })

  it('rejects a malformed stored value through its decoder', () => {
    const data = new Map<string, unknown>([[KEY, { not: 'a list' }]])
    expect(Effect.runSync(storeOver(data).read(SESSION_ID))).toEqual([])
  })
})
