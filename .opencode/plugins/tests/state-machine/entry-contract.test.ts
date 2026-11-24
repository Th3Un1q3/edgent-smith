import { Effect, Exit, Logger } from 'effect'
import { describe, expect, it } from 'vitest'

import { boot, failureOf } from '@tests/helpers/state-machine/session-loop-fixtures'
import { sessionCreated, sessionInterrupted } from '@tests/helpers/state-machine/harness'

import type { Harness } from '@tests/helpers/state-machine/harness'

interface ExecutableTool {
  execute: (input: unknown, context: unknown) => Effect.Effect<unknown, unknown>
}

const signalTool = (harness: Harness): ExecutableTool => {
  const tool = harness.tools.get('signal_send')

  if (tool === undefined) throw new Error('signal_send is not registered')
  return tool
}

const collectLogs = (harness: Harness): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    harness.logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })

// The live host hands the tool a context without an agent when the tab has no
// agent selected, which is the shape the entry refuses.
const runWithoutAgent = (harness: Harness, input: unknown, sessionID: string): Promise<Exit.Exit<unknown, unknown>> =>
  Effect.runPromiseExit(Effect.withLogger(
    signalTool(harness).execute(input, { sessionID, messageID: 'msg_1', id: 'call_1' }),
    collectLogs(harness),
  ))

const failPrompts = (harness: Harness): void => {
  const session = (harness.context as unknown as { session: { synthetic: () => never } }).session

  session.synthetic = () => {
    throw new Error('synthetic exploded')
  }
}

describe('the entry contract', () => {
  it('fails the signal tool with the reason when the call carries no agent identity', async () => {
    const harness = await boot()

    const failure = failureOf(await runWithoutAgent(harness, { type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1'))

    expect(failure.metadata).toMatchObject({ code: 'machine_unavailable', session: 'ses_1', reason: 'no-identity' })
    expect(failure.message).toContain('no-identity')
    expect(harness.logs).toContain('[state-machine] tool ses_1: no-identity')
  })

  it('delivers the rest of the batch after one emit throws', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    failPrompts(harness)

    const exit = await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    expect(Exit.isSuccess(exit)).toBe(true)
    expect(harness.logs.some(line => line.startsWith('[state-machine] emit ses_1: emit.prompt failed cause='))).toBe(true)
    expect(harness.injectedSkills).toEqual(['task-delegation'])
  })

  it('warns instead of discarding a persist with no entry to write', async () => {
    const harness = await boot()

    await harness.emit(sessionInterrupted('ses_1', 'user'))

    expect(harness.logs).toContain('[state-machine] persist ses_1: skipped')
  })

  it('warns instead of discarding a rejected snapshot write', async () => {
    const harness = await boot()

    harness.failStorageWrites = true
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    expect(harness.logs).toContain('[state-machine] persist ses_1: write-failed')
  })
})
