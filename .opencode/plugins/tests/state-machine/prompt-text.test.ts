import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import type { EmitRequest } from '@plugins/state-machine/core/machine'

import { makeHarness, register, sessionCreated, sessionIdle } from '@tests/helpers/state-machine/harness'
import { templateEnd, templateStart, templateText } from '@tests/helpers/state-machine/template-text'

const GOAL_REQUEST = 'Ask the agent what goal this session should accomplish.'
const NUDGE = 'Nudge the agent to do what the active state waits for instead of idling.'

const GOAL_REQUEST_TEXT = templateText('goal_request')
const IDLE_NUDGE_START = templateStart('idle_nudge')
const PARK_SUMMARY_START = templateStart('park_summary')
const PARK_SUMMARY_END = templateEnd('park_summary')

const boot = async () => {
  const harness = makeHarness()

  await register(harness)
  return harness
}

const withMachine = async () => {
  const library = await loadStateMachineLibrary()
  return createStateMachine({ library })
}

const isTextEmit = (emitted: EmitRequest): emitted is EmitRequest & { readonly text: string } =>
  emitted.type === 'emit.prompt' || emitted.type === 'emit.dispatch'

const emittedText = (emits: readonly EmitRequest[]): string => {
  const emitted = emits[0]

  return emitted !== undefined && isTextEmit(emitted) ? emitted.text : ''
}

describe('synthetic prompt descriptions', () => {
  it('describes the goal request it sends when the person first speaks', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))

    expect(harness.synthetics).toEqual([])

    await harness.emitUserMessage('ses_1', 'user', 'ship it')

    const goalRequests = harness.synthetics.filter(message => message.text === GOAL_REQUEST_TEXT)

    expect(goalRequests).toHaveLength(1)
    expect(goalRequests[0]?.description).toBe(GOAL_REQUEST)
  })

  it('describes the nudge it sends on idle', async () => {
    const harness = await boot()

    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.emit(sessionIdle('ses_1'))

    const nudge = harness.synthetics.find(message => message.text.startsWith(IDLE_NUDGE_START))

    expect(nudge?.description).toBe(NUDGE)
    expect(nudge?.description).not.toBe(GOAL_REQUEST)
  })

  it('gives every synthetic prompt a sentence describing what the loop is doing', async () => {
    const harness = await boot()

    harness.shellResult = { ok: false, exitCode: 1, output: 'type error' }
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.emitUserMessage('ses_1', 'user', 'ship it')
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')

    expect(harness.synthetics.length).toBeGreaterThan(2)

    for (const message of harness.synthetics) {
      expect(message.description).toMatch(/^[A-Z][a-z]+ (?:[^.\s]+ ){3,}[^.\s]+\.$/)
    }
  })
})

describe('the park summary', () => {
  it('does not double the period when the goal and the lesson already end with one', async () => {
    const machine = await withMachine()

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it.' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')

    machine.signal({ type: 'LESSON', payload: { text: 'read the line.' } }, 'ses_1')

    const emits = machine.signal({ type: 'RETROSPECTIVE_COMPLETE' }, 'ses_1').emits
    const text = emittedText(emits)

    expect(text.startsWith(PARK_SUMMARY_START)).toBe(true)
    expect(text.endsWith(PARK_SUMMARY_END)).toBe(true)
    expect(text).toContain('ship it.')
    expect(text).toContain('read the line.')
    expect(text).not.toContain('..')
  })
})
