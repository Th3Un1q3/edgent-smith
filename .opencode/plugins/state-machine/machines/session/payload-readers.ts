import type {
  CallbackPayload,
  InjectedMemories,
  IntentKind,
  LoopEvent,
} from '../../core/machine'

import type { ActorSelf } from './definition-contract'

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const leafOf = (value: unknown): string =>
  typeof value === 'string' ? value : (isObject(value) ? leafOf(Object.values(value).at(-1)) : '')

/**
A state's entry emits before the actor has initialized, when its snapshot cannot be
read; a template that does not name a state ignores the empty value.
*/
export const leafState = (self: ActorSelf): string => {
  try {
    return leafOf(self.getSnapshot().value)
  }
  catch {
    return ''
  }
}

export const readPayloadField = (event: LoopEvent, field: string): string => {
  const payload = (event as { payload?: unknown }).payload
  const value = isObject(payload) ? payload[field] : undefined
  return typeof value === 'string' ? value : ''
}

const INTENT_KINDS: readonly IntentKind[] = ['none', 'improvement', 'lesson']

export const isIntentKind = (value: unknown): value is IntentKind =>
  typeof value === 'string' && (INTENT_KINDS as readonly string[]).includes(value)

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const isInjectedMemories = (value: unknown): value is InjectedMemories =>
  isObject(value) && isStringArray(value.full) && isStringArray(value.index)

const asNumber = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined

const asString = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined

const callbackFields = (payload: Record<string, unknown>): CallbackPayload => ({
  ok: payload.ok === true,
  exitCode: asNumber(payload.exitCode),
  output: asString(payload.output),
  value: isInjectedMemories(payload.value) ? payload.value : undefined,
})

export const readCallback = (event: LoopEvent): CallbackPayload => {
  const payload = (event as { payload?: unknown }).payload

  return isObject(payload) ? callbackFields(payload) : { ok: false }
}
