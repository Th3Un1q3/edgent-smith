/**
 * Namespaced per-session store over `context.storage`: the factory owns the
 * `<prefix><sessionID>` key, the read, the write, the removal and the paged
 * scan, so a call site supplies only its prefix and its decode step.
 *
 * Each caller keeps its own defaulting: the decode function decides what an
 * absent or malformed stored value becomes, so one site defaults to an empty
 * record, another leaves `undefined`, and a third reads a nested array.
 */
import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'

type Storage = Context['storage']

/**
One page of session ids under the prefix, with the cursor for the next page.
*/
export interface ScannedPage {
  readonly ids: readonly string[]
  readonly next: string | undefined
}

export const namespacedStore = <A>(
  storage: Storage,
  prefix: string,
  decode: (stored: unknown) => A,
) => {
  const keyOf = (sessionID: string): string => prefix + sessionID
  const sessionOf = (key: string): string => key.slice(prefix.length)
  return {
    read: (sessionID: string) => Effect.map(storage.get(keyOf(sessionID)), decode),
    // `storage.set` takes `Schema.Json`; the store is the one place a caller's payload
    // reaches that boundary, so the narrowing lives here rather than at every call site.
    write: (sessionID: string, value: unknown) =>
      Effect.asVoid(storage.set(keyOf(sessionID), value as Parameters<Storage['set']>[1])),
    remove: (sessionID: string) => Effect.asVoid(storage.remove(keyOf(sessionID))),
    scanPage: (after?: string) => Effect.map(
      storage.scan(after === undefined ? { prefix } : { prefix, after }),
      page => ({ ids: page.entries.map(entry => sessionOf(entry.key)), next: page.next }),
    ),
  }
}
