/**
 * The host inbox item, as `session.inbox.enqueued` carries it. Only a `user`
 * item resets the loop, and its text lives under `payload.text` (the schema's
 * `User` item); a synthetic, compaction or move item is ignored.
 */
export interface InboxItem {
  readonly type?: unknown
  readonly payload?: { readonly text?: unknown }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isUserItem = (item: unknown): boolean => isObject(item) && item.type === 'user'

export const readUserText = (item: unknown): string => {
  if (!isObject(item)) return ''

  const payload = item.payload

  return isObject(payload) && typeof payload.text === 'string' ? payload.text : ''
}
