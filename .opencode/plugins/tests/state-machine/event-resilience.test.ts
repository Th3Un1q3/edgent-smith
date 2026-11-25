import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import { boot, content } from '@tests/helpers/state-machine/session-loop-fixtures'
import { sessionCreated, sessionIdle, sessionInterrupted } from '@tests/helpers/state-machine/harness'

import type { Harness } from '@tests/helpers/state-machine/harness'

// A reload keeps the host storage and loses the factory's in-memory entries.
const reload = async (previous: Harness): Promise<Harness> => {
  const restarted = await boot()

  restarted.storageWrites.push(...previous.storageWrites)

  return restarted
}

const isFirstReadOf = (reads: number, input: { sessionID?: string } | undefined, sessionId: string): boolean =>
  reads === 1 && input?.sessionID === sessionId

const failFirstIdentityRead = (harness: Harness, sessionId: string): void => {
  const session = harness.context.session as unknown as {
    get: (input?: { sessionID?: string }) => Effect.Effect<unknown>
  }
  const read = session.get
  let reads = 0

  session.get = (input) => {
    reads += 1

    return isFirstReadOf(reads, input, sessionId)
      ? Effect.sync(() => {
          throw new Error('host identity read crashed')
        })
      : read(input)
  }
}

describe('idle after a reload', () => {
  it('restores the session from its snapshot and nudges it', async () => {
    const first = await boot()

    await first.emit(sessionCreated('ses_1', 'rug'))
    await first.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await first.runTool({ type: 'PLAN_READY' }, 'ses_1')

    const restarted = await reload(first)

    const writesBefore = restarted.storageWrites.filter(write => write.key.endsWith('/ses_1')).length

    await restarted.emit(sessionIdle('ses_1'))

    expect(restarted.synthetics.some(message => message.text.includes('CLAIM_WORK'))).toBe(true)
    expect(restarted.storageWrites.filter(write => write.key.endsWith('/ses_1')).length).toBeGreaterThan(writesBefore)

    const accepted = await restarted.runTool({ type: 'CLAIM_WORK' }, 'ses_1')

    expect(content(accepted)).toBe('Signal accepted.')
  })

  it('logs a throwing handler and still serves the next idle for that session', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')

    failFirstIdentityRead(harness, 'ses_1')

    await harness.emit(sessionIdle('ses_1'))

    expect(harness.logs.some(line => line.includes('handler session=ses_1 event=session.idle failed'))).toBe(true)

    const spoken = harness.synthetics.length

    await harness.emit(sessionIdle('ses_1'))

    expect(harness.synthetics.slice(spoken).some(message => message.text.includes('CLAIM_WORK'))).toBe(true)
  })
})

describe('unavailable machines', () => {
  it('reports an interruption for a session the loop never opened', async () => {
    const harness = await boot()

    await harness.emit(sessionInterrupted('ses_ghost', 'shutdown'))

    expect(harness.synthetics).toHaveLength(0)
    expect(harness.logs.some(line => line.includes('[state-machine] interrupted ses_ghost: no-identity'))).toBe(true)
  })

  it('reports an unreadable snapshot instead of idling a machine-less session', async () => {
    const harness = await boot()

    harness.failStorageReads = true

    await harness.emit(sessionIdle('ses_2'))

    expect(harness.synthetics).toHaveLength(0)
    expect(harness.logs.some(line => line.includes('[state-machine] idle ses_2: read-failed'))).toBe(true)
  })
})
