import { Effect, Logger } from 'effect'
import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary } from '@plugins/state-machine/core/machine'
import { boot } from '@tests/helpers/state-machine/session-loop-fixtures'

const collect = (logs: string[]): Logger.Logger<unknown, void> =>
  Logger.make<unknown, void>(({ message }) => {
    logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })

// The design allows `start` and `access`; every other member is a handle-free
// read the entry, the hooks and the existing suites still call. `ensure` survives
// because `tests/state-machine/persistence.test.ts` drives it and that file sits
// outside this change's allowlist, which keeps it from being deleted here.
const SHIPPED_SURFACE = [
  'access',
  'callback',
  'ensure',
  'get',
  'idle',
  'interrupted',
  'persist',
  'policy',
  'signal',
  'signalLine',
  'start',
  'state',
  'status',
  'userInput',
  'wake',
]

describe('the factory surface', () => {
  it('exports exactly the closed set of members the design ships', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({ library })

    expect(Object.keys(machine).sort((left, right) => left.localeCompare(right))).toEqual(SHIPPED_SURFACE)
  })

  it('logs the skip at the factory when there is no store to write', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({ library })
    const logs: string[] = []

    const status = await Effect.runPromise(Effect.withLogger(machine.persist('ses_1'), collect(logs)))

    expect(status).toBe('skipped')
    expect(logs).toContain('[state-machine] persist ses_1: skipped')
  })

  it('logs the typed reason when open cannot restore the session', async () => {
    const harness = await boot()

    harness.failStorageReads = true
    await harness.emitUserMessage('ses_1', 'user', 'start work')

    expect(harness.logs.some(line => line.startsWith('[state-machine] open ses_1: read-failed'))).toBe(true)
  })
})
