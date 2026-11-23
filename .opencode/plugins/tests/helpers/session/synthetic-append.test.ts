import { Effect, Logger } from 'effect'
import { describe, expect, it } from 'vitest'

import { appendSynthetic } from '@plugins/helpers/session/synthetic-append'

const render = (part: unknown): string => typeof part === 'string' ? part : JSON.stringify(part)

const withLogs = async <A, E>(program: Effect.Effect<A, E>): Promise<{ readonly value: A, readonly logs: string[] }> => {
  const logs: string[] = []
  const collect = Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(part => render(part)).join(' ') : String(message))
  })
  const value = await Effect.runPromise(Effect.withLogger(program, collect))
  return { value, logs }
}

const succeeding = (text: string): Effect.Effect<{ readonly text: string }, Error> => Effect.succeed({ text })
const failing = (cause: Error): Effect.Effect<never, Error> => Effect.fail(cause)

const boom = failing(new Error('boom'))
const nope = failing(new Error('nope'))
const quiet = failing(new Error('quiet'))

describe('appendSynthetic', () => {
  it('returns true when the append lands, with no failure policy running', async () => {
    const result = await withLogs(appendSynthetic(succeeding('hi'), { _tag: 'silent' }))

    expect(result.value).toBe(true)
    expect(result.logs).toEqual([])
  })

  it('logs the caller tag and the error, then returns false under the log policy', async () => {
    const result = await withLogs(appendSynthetic(boom, { _tag: 'log', tag: '[gate] ' }))

    expect(result.value).toBe(false)
    expect(result.logs.join('\n')).toContain('[gate] synthetic append failed')
    expect(result.logs.join('\n')).toContain('boom')
  })

  it('runs the caller reporter with the failure and returns false under the report policy', async () => {
    const seen: string[] = []
    const policy = {
      _tag: 'report' as const,
      onFailure: (failure: Error) => Effect.sync(() => { seen.push(String(failure)) }),
    }

    const result = await withLogs(appendSynthetic(nope, policy))

    expect(result.value).toBe(false)
    expect(seen).toEqual(['Error: nope'])
  })

  it('swallows the failure silently and returns false under the silent policy', async () => {
    const result = await withLogs(appendSynthetic(quiet, { _tag: 'silent' }))

    expect(result.value).toBe(false)
    expect(result.logs).toEqual([])
  })
})
