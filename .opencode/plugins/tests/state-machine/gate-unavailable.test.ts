import { Cause, Effect, Exit, Logger, Option } from 'effect'

import { describe, expect, it } from 'vitest'

import { MachineUnavailable } from '@plugins/state-machine/core/machine'
import type { StateMachine, UnavailableReason } from '@plugins/state-machine/core/machine'
import { decide, UNAVAILABLE_STATE, unavailableMessage } from '@plugins/state-machine/core/policy'
import { createExecuteBeforeHook } from '@plugins/state-machine/hooks/execute-before'

import type { ExecuteBeforePorts, ExecuteBeforeRequest } from '@plugins/state-machine/hooks/execute-before'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine/harness'

import type { Harness } from '@tests/helpers/state-machine/harness'

const SESSION = 'ses_1'
const REQUEST: ExecuteBeforeRequest = { sessionId: SESSION, agent: 'rug', tool: 'edit', input: {} }
const HOST_PAYLOAD = { tool: 'edit', agent: 'rug', sessionID: SESSION }

type Hook = (request: ExecuteBeforeRequest) => Effect.Effect<void, unknown>

interface Run {
  readonly exit: Exit.Exit<void, unknown>
  readonly logs: string[]
}

const collectingLogger = (logs: string[]): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })

const run = async <Argument>(hook: (argument: Argument) => Effect.Effect<void, unknown>, payload: Argument): Promise<Run> => {
  const logs: string[] = []
  const exit = await Effect.runPromiseExit(Effect.withLogger(hook(payload), collectingLogger(logs)))

  return { exit, logs }
}

const hookFor = (machine: StateMachine, parentOf?: ExecuteBeforePorts['parentOf']): Hook =>
  createExecuteBeforeHook({
    machine,
    open: () => Effect.succeed(true),
    parentOf: parentOf ?? (() => Effect.succeed(undefined)),
  })

const unavailableOn = (reason: UnavailableReason): StateMachine =>
  ({ access: () => Effect.fail(new MachineUnavailable({ sessionId: SESSION, reason })) }) as unknown as StateMachine

const toolErrorOf = (exit: Exit.Exit<void, unknown>): {
  readonly message: string
  readonly metadata?: Readonly<Record<string, unknown>>
} => {
  if (Exit.isSuccess(exit)) throw new Error('expected a failed hook')

  const error = Exit.findErrorOption(exit)

  if (Option.isNone(error)) throw new Error('expected a typed error: ' + Cause.pretty(exit.cause))

  return error.value as { message: string, metadata?: Readonly<Record<string, unknown>> }
}

// The registration takes the host payload (`sessionID`), not the hook request.
const hostHookOf = (harness: Harness): ((payload: unknown) => Effect.Effect<void>) => {
  const hook = harness.toolHooks.get('execute.before')
  if (hook === undefined) throw new Error('execute.before is not registered')
  return hook
}

describe('a gate over an unavailable machine', () => {
  it('blocks a gated tool and logs the reason', async () => {
    const { exit, logs } = await run(hookFor(unavailableOn('no-entry')), REQUEST)

    expect(Exit.isFailure(exit)).toBe(true)
    expect(toolErrorOf(exit).metadata).toMatchObject({
      code: 'tool_blocked',
      tool: 'edit',
      state: UNAVAILABLE_STATE,
      allowed_tools: [],
    })
    expect(logs).toContain('[state-machine] execute.before ses_1: no-entry')
  })

  it('names the reason the snapshot read failed', async () => {
    const { exit, logs } = await run(hookFor(unavailableOn('read-failed')), REQUEST)

    expect(toolErrorOf(exit).message).toBe(unavailableMessage('edit', 'read-failed'))
    expect(logs).toContain('[state-machine] execute.before ses_1: read-failed')
  })
})

describe('the gate decision', () => {
  it('blocks an absent state instead of allowing it', () => {
    const decision = decide({ agent: 'rug', isChild: false, tool: 'edit' })
    const message = decision.allowed ? '' : decision.message

    expect(decision.allowed).toBe(false)
    expect(message).toContain(UNAVAILABLE_STATE)
  })
})

describe('the parent read', () => {
  const withFailingParent = (): Hook =>
    hookFor(unavailableOn('no-entry'), () => Effect.fail(new Error('session read refused')))

  it('blocks with parent-unreadable rather than reading it as no parent', async () => {
    const { exit, logs } = await run(withFailingParent(), REQUEST)

    expect(Exit.isFailure(exit)).toBe(true)
    expect(toolErrorOf(exit).message).toBe(unavailableMessage('edit', 'parent-unreadable'))
    expect(logs).toContain('[state-machine] execute.before ses_1: parent-unreadable')
  })

  it('reports the machine reason when the parent read succeeds with no parent', async () => {
    const { logs } = await run(hookFor(unavailableOn('no-entry')), REQUEST)

    expect(logs).toContain('[state-machine] execute.before ses_1: no-entry')
  })

  it('allows a child session without reading the machine', async () => {
    const { exit, logs } = await run(hookFor(unavailableOn('no-entry'), () => Effect.succeed('ses_parent')), REQUEST)

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(logs).toHaveLength(1)
  })
})

describe('the hook in the plugin', () => {
  it('blocks a gated tool when the session read is rejected', async () => {
    const harness = makeHarness()
    harness.failStorageReads = true
    await register(harness)
    await harness.emit(sessionCreated(SESSION, 'rug'))

    const { exit, logs } = await run(hostHookOf(harness), HOST_PAYLOAD)

    expect(Exit.isFailure(exit)).toBe(true)
    expect(toolErrorOf(exit).metadata).toMatchObject({ code: 'tool_blocked', state: UNAVAILABLE_STATE })
    expect(logs).toContain('[state-machine] execute.before ses_1: read-failed')
  })
})
