import { Duration, Effect, Exit, Logger, Option, Stream } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Context } from '@opencode/plugin/effect/plugin'
import type { StateMachine } from '@plugins/state-machine/core/machine'
import { unavailableMessage } from '@plugins/state-machine/core/policy'
import { registerSessionEvents } from '@plugins/state-machine/events/session-events'
import type { SessionEventDependencies } from '@plugins/state-machine/events/session-events'
import { createExecuteBeforeHook } from '@plugins/state-machine/hooks/execute-before'
import type { ExecuteBeforeRequest } from '@plugins/state-machine/hooks/execute-before'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine/harness'

const SESSION = 'ses_1'
const REQUEST: ExecuteBeforeRequest = { sessionId: SESSION, agent: 'rug', tool: 'edit', input: {} }
const HOST_PAYLOAD = { tool: 'edit', agent: 'rug', sessionID: SESSION }

const collectingLogger = (logs: string[]): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })

const run = async <Argument>(
  hook: (argument: Argument) => Effect.Effect<void, unknown>,
  payload: Argument,
): Promise<{ readonly exit: Exit.Exit<void, unknown>, readonly logs: string[] }> => {
  const logs: string[] = []
  const exit = await Effect.runPromiseExit(Effect.withLogger(hook(payload), collectingLogger(logs)))

  return { exit, logs }
}

const errorMessageOf = (exit: Exit.Exit<void, unknown>): string => {
  const error = Exit.findErrorOption(exit)

  if (Option.isNone(error)) throw new Error('expected a typed error')

  return (error.value as { message?: string }).message ?? ''
}

describe('a parent read that fails', () => {
  it('blocks the gate and names the failed read instead of gating the child as a root', async () => {
    const harness = makeHarness()
    await register(harness)

    const session = harness.context.session as unknown as {
      get: (input?: { sessionID?: string }) => Effect.Effect<unknown, unknown>
    }
    session.get = () => Effect.fail(new Error('identity read refused'))

    const hook = harness.toolHooks.get('execute.before')

    if (hook === undefined) throw new Error('execute.before is not registered')

    const { exit, logs } = await run(hook, HOST_PAYLOAD)

    expect(Exit.isFailure(exit)).toBe(true)
    expect(errorMessageOf(exit)).toBe(unavailableMessage('edit', 'parent-unreadable'))
    expect(logs).toContain('[state-machine] parent ses_1: read-failed')
  })
})

describe('a gate without a policy', () => {
  it('logs the absent policy instead of refusing with an empty allowlist', async () => {
    const machine = {
      access: () => Effect.succeed({ sessionId: SESSION, state: 'idle', policy: undefined }),
    } as unknown as StateMachine

    const { logs } = await run(
      createExecuteBeforeHook({ machine, open: () => Effect.succeed(true), parentOf: () => Effect.succeed(undefined) }),
      REQUEST,
    )

    expect(logs).toContain('[state-machine] execute.before ses_1: no-policy')
  })
})

describe('an access effect that defects', () => {
  it('logs the session and the defect instead of returning with no line', async () => {
    const logs: string[] = []
    const context = {
      event: { subscribe: () => Stream.make(sessionCreated(SESSION, 'rug')) },
      session: { get: () => Effect.succeed({ agent: 'rug' }) },
    } as unknown as Context

    const dependencies = {
      context,
      machine: { access: () => Effect.die(new Error('machine exploded')) },
      open: () => Effect.succeed(true),
      ensureSession: () => Effect.succeed(undefined),
      parentOf: () => Effect.succeed(undefined),
      logSnapshot: () => Effect.void,
      deliver: () => Effect.void,
      persist: () => Effect.void,
      offerIdle: () => Effect.void,
    } as unknown as SessionEventDependencies

    const program = Effect.scoped(Effect.flatMap(
      registerSessionEvents(dependencies),
      () => Effect.sleep(Duration.millis(20)),
    ))

    await Effect.runPromise(Effect.withLogger(program, collectingLogger(logs)))

    expect(logs.some(line => line.includes('[state-machine] session.created ses_1: defect'))).toBe(true)
    expect(logs.some(line => line.includes('machine exploded'))).toBe(true)
  })
})
