import type { LoopContext, LoopEvent } from '../../core/machine'
import { memoryKey } from '../../core/memory'

import type { RecordCallbackParameters, RecordParameters, RecordSource } from './definition-contract'
import { isIntentKind, readCallback, readPayloadField } from './payload-readers'

const readSource = (event: LoopEvent, source: RecordSource): string | number =>
  source.from === 'literal' ? source.value : readPayloadField(event, source.field)

type RecordFrom<Op extends RecordParameters['op']> = Extract<RecordParameters, { readonly op: Op }>

const failureFor = (parameters: RecordFrom<'fail'>): Partial<LoopContext> => ({
  failure: { reason: parameters.reason, detail: parameters.detail },
})

const incrementFor = (context: LoopContext, parameters: RecordFrom<'increment'>): Partial<LoopContext> =>
  parameters.key === 'nudges' ? { nudges: context.nudges + 1 } : { attempts: context.attempts + 1 }

const cappedList = (list: readonly string[], value: string, limit: number): string[] =>
  limit > 0 ? [...list, value].slice(-limit) : []

const PUSHED: Record<RecordFrom<'push'>['key'], (context: LoopContext, value: string) => Partial<LoopContext>> = {
  memories: (context, value) => ({ memories: cappedList(context.memories, value, context.memoryLimit) }),
  improvements: (context, value) => ({ improvements: cappedList(context.improvements, value, context.memoryLimit) }),
}

const applyPush = (context: LoopContext, parameters: RecordFrom<'push'>, value: string | number): Partial<LoopContext> =>
  typeof value === 'string' ? PUSHED[parameters.key](context, value) : {}

const intentOr = (value: string | number, current: LoopContext['intent']): LoopContext['intent'] =>
  isIntentKind(value) ? value : current

const countOr = (value: string | number, current: number): number =>
  typeof value === 'number' ? value : current

const textOr = (value: string | number, current: string): string =>
  typeof value === 'string' ? value : current

const SCALAR_APPLIERS: Record<RecordFrom<'set'>['key'], (context: LoopContext, value: string | number) => Partial<LoopContext>> = {
  intent: (context, value) => ({ intent: intentOr(value, context.intent) }),
  nudges: (context, value) => ({ nudges: countOr(value, context.nudges) }),
  attempts: (context, value) => ({ attempts: countOr(value, context.attempts) }),
  goal: (context, value) => ({ goal: textOr(value, context.goal) }),
}

const applyScalar = (context: LoopContext, parameters: RecordFrom<'set'>, value: string | number): Partial<LoopContext> =>
  SCALAR_APPLIERS[parameters.key](context, value)

const applyValue = (
  context: LoopContext,
  parameters: RecordFrom<'push'> | RecordFrom<'set'>,
  value: string | number,
): Partial<LoopContext> =>
  parameters.op === 'push' ? applyPush(context, parameters, value) : applyScalar(context, parameters, value)

export const applyRecord = (context: LoopContext, event: LoopEvent, parameters: RecordParameters): Partial<LoopContext> => {
  if (parameters.op === 'fail') return failureFor(parameters)
  if (parameters.op === 'increment') return incrementFor(context, parameters)

  const value = readSource(event, parameters.source)

  return applyValue(context, parameters, value)
}

/**
A recalled memory is keyed by its namespace-qualified path: the `.md` extension
drops, the `mem:` prefix and `:complete` kind stay. The directory stays in the
key so two namespaces holding the same file name recall independently.
*/
const memoryToken = (namespace: string): string =>
  memoryKey(namespace.replace(/\.md$/, ''), 'complete')

/**
Memory keys kept per session; the oldest drop first.
*/
const MEMORY_TOKEN_LIMIT = 200

const withInjection = (
  context: LoopContext,
  results: LoopContext['results'],
  key: string,
  value: LoopContext['injected'][string],
): Partial<LoopContext> => {
  const token = memoryToken(key)
  const tokens = context.memoryTokens ?? []

  return tokens.includes(token)
    ? { results }
    : {
        results,
        injected: { ...context.injected, [key]: value },
        memoryTokens: [...tokens, token].slice(-MEMORY_TOKEN_LIMIT),
      }
}

const failedReport = (
  parameters: RecordCallbackParameters,
  payload: ReturnType<typeof readCallback>,
  results: LoopContext['results'],
): Partial<LoopContext> => ({
  results,
  failure: { reason: parameters.reportTo + ' failed', detail: payload.output },
})

const appliedInjection = (
  context: LoopContext,
  results: LoopContext['results'],
  parameters: RecordCallbackParameters,
  payload: ReturnType<typeof readCallback>,
): Partial<LoopContext> =>
  payload.value === undefined || parameters.key === undefined
    ? { results }
    : withInjection(context, results, parameters.key, payload.value)

export const applyRecordCallback = (
  context: LoopContext,
  event: LoopEvent,
  parameters: RecordCallbackParameters,
): Partial<LoopContext> => {
  const payload = readCallback(event)
  const results = { ...context.results, [parameters.reportTo]: payload }

  return payload.ok ? appliedInjection(context, results, parameters, payload) : failedReport(parameters, payload, results)
}
