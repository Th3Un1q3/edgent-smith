import { Effect, Exit } from 'effect'

import { describe, expect, it } from 'vitest'

import { createStateMachinePlugin } from '@plugins/state-machine'
import { loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine/harness'
import { failureOf } from '@tests/helpers/state-machine/session-loop-fixtures'

import type { Harness } from '@tests/helpers/state-machine/harness'

const content = (exit: Exit.Exit<unknown, unknown>): string => {
  if (!Exit.isSuccess(exit)) throw new Error('tool call failed')
  return (exit.value as { content: string }).content
}

const boot = async (): Promise<Harness> => {
  const harness = makeHarness()

  await register(harness)
  return harness
}

const openMachine = async (harness: Harness): Promise<Harness> => {
  await harness.emit(sessionCreated('ses_1', 'rug'))
  return harness
}

describe('the library load', () => {
  it('fails the plugin load when the library rejects with a non-Error value', async () => {
    const harness = makeHarness()
    const failing = createStateMachinePlugin(() => Promise.reject('library missing'))

    const exit = await Effect.runPromiseExit(Effect.scoped(failing.effect(harness.context)))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(harness.tools.size).toBe(0)
  })
})

describe('host paths', () => {
  it('ignores an interruption whose reason the loop does not know', async () => {
    const harness = await openMachine(await boot())

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
    await harness.emit({
      type: 'session.execution.interrupted',
      data: { sessionID: 'ses_1', reason: 'not-a-known-reason' },
    })

    expect(harness.synthetics.some(message => message.text.includes('Waiting for your next instruction')))
      .toBe(false)
  })

  it('ignores an interruption whose reason is not a string', async () => {
    const harness = await openMachine(await boot())

    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
    await harness.emit({
      type: 'session.execution.interrupted',
      data: { sessionID: 'ses_1', reason: 42 },
    })

    expect(harness.synthetics.some(message => message.text.includes('Waiting for your next instruction')))
      .toBe(false)
  })

  it('refuses a tool call that carries no agent identity', async () => {
    const harness = await boot()
    const tool = harness.tools.get('signal_send')

    if (tool === undefined) throw new Error('signal_send is not registered')

    const exit = await Effect.runPromiseExit(tool.execute({ type: 'CLAIM_WORK' }, { sessionID: 'ses_1' }))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(failureOf(exit).metadata).toMatchObject({
      code: 'machine_unavailable',
      session: 'ses_1',
      reason: 'no-identity',
    })
  })

  it('reports a shell that cannot start as a failed quality check', async () => {
    const harness = makeHarness()

    ;(harness.context.location as { directory: string }).directory = '/nonexistent-state-machine-cwd'
    const plugin = createStateMachinePlugin(loadStateMachineLibrary)

    await Effect.runPromise(Effect.scoped(plugin.effect(harness.context)))

    const tool = harness.tools.get('signal_send')

    if (tool === undefined) throw new Error('signal_send is not registered')

    const run = (input: unknown): Promise<Exit.Exit<unknown, unknown>> =>
      Effect.runPromiseExit(tool.execute(input, { sessionID: 'ses_1', agent: 'rug' }))

    expect(content(await run({ type: 'SET_GOAL', payload: { goal: 'ship it' } })))
      .toContain('Signal accepted.')
    expect(content(await run({ type: 'PLAN_READY' }))).toContain('Signal accepted.')
    expect(content(await run({ type: 'CLAIM_WORK' }))).toContain('Signal accepted.')
    expect(harness.synthetics.some(message => message.text.includes('Quality check failed')))
      .toBe(true)
  })
})
