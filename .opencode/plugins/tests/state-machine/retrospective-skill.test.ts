import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, RETROSPECTIVE_COMPLETE } from '@plugins/state-machine/core/machine'

import { stateAt } from '@tests/helpers/state-machine/session-loop-fixtures'

const RETROSPECTIVE = 'towards_goal.retrospective'
const SKILL = 'harness-management'
const COMMAND = 'sessions/retrospect'

interface EntryAction {
  readonly type: string
  readonly params?: { readonly name?: string }
}

const entry = (): readonly EntryAction[] =>
  (stateAt(RETROSPECTIVE) as unknown as { entry: readonly EntryAction[] }).entry

const isNamed = (action: EntryAction, name: string): boolean => action.params?.name === name

const indexOf = (type: string, name: string): number =>
  entry().findIndex(action => action.type === type && isNamed(action, name))

const emitIndexOf = (emits: readonly { readonly type: string }[], type: string): number =>
  emits.findIndex(emitted => emitted.type === type)

describe('the retrospective skill activation', () => {
  it('activates harness-management before raising the retrospective command', () => {
    const skill = indexOf('activate_skill', SKILL)
    const command = indexOf('run_command', COMMAND)

    expect(entry()[skill]).toEqual({ type: 'activate_skill', params: { name: SKILL } })
    expect(skill).toBeLessThan(command)
    expect(entry()[command]).toEqual({ type: 'run_command', params: { name: COMMAND } })
    expect(entry()).toContainEqual({
      type: 'update_signals_policy',
      params: { set_enabled_signals: [RETROSPECTIVE_COMPLETE] },
    })
  })

  it('requests the skill and the command on the LESSON that enters retrospective', async () => {
    const machine = createStateMachine({ library: await loadStateMachineLibrary() })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('memorize')

    const entered = machine.signal({ type: 'LESSON', payload: { text: 'read the line' } }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('retrospective')
    expect(entered.emits).toContainEqual({ type: 'emit.skill', name: SKILL, reportTo: 'skill_ready' })
    expect(entered.emits.filter(emitted => emitted.type === 'emit.command')).toEqual([
      { type: 'emit.command', name: COMMAND },
    ])
    expect(emitIndexOf(entered.emits, 'emit.skill')).toBeLessThan(emitIndexOf(entered.emits, 'emit.command'))
  })
})
