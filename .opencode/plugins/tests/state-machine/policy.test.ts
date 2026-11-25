import { Effect, Exit, Logger, Option } from 'effect'

import { describe, expect, it } from 'vitest'

import { createStateMachine, loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'
import { decide, GATE_AGENT, renderPolicyMessage } from '@plugins/state-machine/core/policy'
import { createSnapshotRecord, snapshotKey } from '@plugins/state-machine/core/snapshot'

import type { ActionSpec as MachineActionSpec, LoopState, LoopStateId } from '@plugins/state-machine/core/machine'
import type { PersistedSnapshot, ToolPolicyRule } from '@plugins/state-machine/core/snapshot'
import type { StoredSession } from '@plugins/state-machine/machines/session/context'
import type { ActionSpec } from '@plugins/state-machine/machines/session/definitions'

import { makeHarness, register, sessionCreated } from '@tests/helpers/state-machine/harness'

import type { Harness } from '@tests/helpers/state-machine/harness'

const NOW = Date.parse('2026-11-16T12:00:00.000Z')

const stateAt = (path: LoopStateId): LoopState => {
  const [root, child] = path.split('.') as [LoopStateId, string | undefined]
  const node = SESSION_LOOP.states[root]
  return child === undefined ? node : (node.states as Readonly<Record<string, LoopState>> | undefined)?.[child] as LoopState
}

const statePaths = (states: Readonly<Record<string, LoopState>>, prefix = ''): LoopStateId[] =>
  Object.entries(states).flatMap(([id, config]) => {
    const path = prefix === '' ? id : prefix + '.' + id
    const children = config.states as Readonly<Record<string, LoopState>> | undefined
    return children === undefined ? [path] : [path, ...statePaths(children, path)]
  })

const actionsOf = (state: LoopStateId): readonly MachineActionSpec[] => [
  ...(stateAt(state).entry ?? []),
  ...(stateAt(state).exit ?? []),
]

const setPolicyAction = (): Extract<ActionSpec, { type: 'set_tools_policy' }> => {
  const action = (stateAt('towards_goal.define_goal').entry ?? []).find(candidate => candidate.type === 'set_tools_policy')
  if (action === undefined) throw new Error('define_goal declares no set_tools_policy action')
  return action as Extract<ActionSpec, { type: 'set_tools_policy' }>
}

const defineGoalRule = (): ToolPolicyRule => {
  const { params } = setPolicyAction()
  if (params.allowedTools === null) throw new Error('define_goal declares a clearing set_tools_policy action')
  return { stateId: params.stateId, errorMessage: params.errorMessage, allowedTools: params.allowedTools }
}

const contextFixture = (overrides: Partial<StoredSession> = {}): StoredSession => ({
  sessionId: 'ses_1',
  goal: '',
  intent: 'none',
  attempts: 0,
  nudges: 0,
  memories: [],
  improvements: [],
  injectedSkills: [],
  injected: {},
  results: {},
  ...overrides,
})

const snapshotFixture = (context: Partial<StoredSession> = {}): PersistedSnapshot => ({
  status: 'active',
  value: { towards_goal: 'define_goal' },
  context: contextFixture(context),
  children: {},
})

const hookOf = (harness: Harness): ((payload: unknown) => Effect.Effect<void, unknown>) => {
  const hook = harness.toolHooks.get('execute.before')
  if (hook === undefined) throw new Error('execute.before is not registered')
  return hook
}

const runHook = async (harness: Harness, payload: Record<string, unknown>): Promise<Exit.Exit<void, unknown>> => {
  const collect = Logger.make<unknown, void>(() => {})
  return Effect.runPromiseExit(Effect.withLogger(hookOf(harness)(payload), collect))
}

const messageOf = (exit: Exit.Exit<void, unknown>): string => {
  if (Exit.isSuccess(exit)) return ''
  const failure = exit.cause
  return JSON.stringify(failure)
}

const toolErrorOf = (exit: Exit.Exit<void, unknown>): {
  readonly message: string
  readonly metadata?: Readonly<Record<string, unknown>>
} => {
  if (Exit.isSuccess(exit)) throw new Error('expected a failed hook')

  const error = Exit.findErrorOption(exit)

  if (Option.isNone(error)) throw new Error('expected a typed error')

  return error.value as { message: string, metadata?: Readonly<Record<string, unknown>> }
}

describe('the declared policy', () => {
  it('sets it on define_goal entry and clears it on exit', () => {
    const types = actionsOf('towards_goal.define_goal').map(action => action.type)

    expect(types).toContain('set_tools_policy')
    expect(stateAt('towards_goal.define_goal').exit).toEqual([{ type: 'set_tools_policy', params: { allowedTools: null } }])
  })

  it('declares a policy only for plan', () => {
    const others = statePaths(SESSION_LOOP.states).filter(state => state !== 'towards_goal.define_goal')
    const declared = others.flatMap(state => actionsOf(state).filter(action =>
      action.type === 'set_tools_policy').map((action) => {
      const parameters = action.params as { stateId?: string, allowedTools?: readonly string[] | null }
      return { stateId: parameters.stateId, allowedTools: parameters.allowedTools }
    }))

    expect(declared).toEqual([
      { stateId: 'plan', allowedTools: ['signal_send', 'question', 'skill'] },
      { stateId: undefined, allowedTools: null },
    ])
  })

  it('declares the four allowed tools', () => {
    expect(defineGoalRule().allowedTools).toEqual(['signal_send', 'execute', 'question', 'skill'])
  })
})

describe('renderPolicyMessage', () => {
  it('substitutes the tool and the state', () => {
    const message = renderPolicyMessage(defineGoalRule(), 'edit')

    expect(message).toBe('Tool edit is blocked in define_goal. Call signal_send with SET_GOAL and a goal to continue.')
  })
})

describe('decide', () => {
  const base = { agent: GATE_AGENT, isChild: false, state: 'define_goal' as const, policy: defineGoalRule(), tool: 'edit' }

  it('allows another agent without reading the rule', () => {
    expect(decide({ ...base, agent: 'build' }).allowed).toBe(true)
  })

  it('allows a child session', () => {
    expect(decide({ ...base, isChild: true }).allowed).toBe(true)
  })

  it('allows a state with no rule', () => {
    expect(decide({ ...base, state: 'work', policy: undefined }).allowed).toBe(true)
  })

  it('allows an allowlisted tool', () => {
    expect(decide({ ...base, tool: 'signal_send' }).allowed).toBe(true)
  })

  it('blocks a tool outside the allowlist with the message', () => {
    const decision = decide(base)

    expect(decision.allowed).toBe(false)
    expect(decision.allowed ? '' : decision.message).toContain('Tool edit is blocked in define_goal')
  })
})

describe('the loop', () => {
  it('carries no policy in work and re-reads it when a user message re-enters define_goal', async () => {
    const machine = createStateMachine({ library: await loadStateMachineLibrary() })
    machine.start('ses_policy', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_policy')
    machine.signal({ type: 'PLAN_READY' }, 'ses_policy')

    expect(machine.policy('ses_policy')).toBeUndefined()

    machine.interrupted('ses_policy', 'user')
    machine.userInput('ses_policy', 'new goal')

    expect(machine.state('ses_policy')).toBe('define_goal')
    expect(machine.policy('ses_policy')?.allowedTools).toEqual(['signal_send', 'execute', 'question', 'skill'])
  })
})

describe('the hook', () => {
  it('blocks edit in define_goal', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isFailure(exit)).toBe(true)

    const error = toolErrorOf(exit)

    expect(error.message).toContain('Tool edit is blocked in define_goal')
    expect(error.metadata).toMatchObject({
      code: 'tool_blocked',
      tool: 'edit',
      state: 'define_goal',
      allowed_tools: ['signal_send', 'execute', 'question', 'skill'],
    })
  })

  it('allows signal_send in define_goal', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'signal_send', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('releases the policy after SET_GOAL', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })
    await harness.runTool({ type: 'PLAN_READY' })

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('allows a tool for another agent', async () => {
    const harness = makeHarness()
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'edit', agent: 'build', sessionID: 'ses_1' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('allows a child session', async () => {
    const harness = makeHarness()
    harness.sessionParents.set('ses_1', 'ses_parent')
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('releases a restored policy after SET_GOAL', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({
      key: snapshotKey('ses_1'),
      value: createSnapshotRecord(snapshotFixture({
        policy: { stateId: 'define_goal', errorMessage: 'Tool <name> is blocked in <state>.', allowedTools: ['signal_send'] },
        signalsPolicy: { names: ['SET_GOAL'] },
      }), NOW),
    })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))
    await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } })
    await harness.runTool({ type: 'PLAN_READY' })

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('gates a restored define_goal from the stored snapshot policy', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({
      key: snapshotKey('ses_1'),
      value: createSnapshotRecord(snapshotFixture({
        policy: { stateId: 'towards_goal.define_goal', errorMessage: 'Snapshot blocks <name> in <state>.', allowedTools: ['signal_send'] },
      }), NOW),
    })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isFailure(exit)).toBe(true)
    expect(messageOf(exit)).toContain('Snapshot blocks edit in towards_goal.define_goal')
  })

  it('allows a restored define_goal whose record predates the stored policy', async () => {
    const harness = makeHarness()
    harness.storageWrites.push({
      key: snapshotKey('ses_1'),
      value: createSnapshotRecord(snapshotFixture(), NOW),
    })
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('blocks edit in define_goal when no event has opened the session yet', async () => {
    const harness = makeHarness()
    await register(harness)

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_cold' })

    expect(Exit.isFailure(exit)).toBe(true)
    expect(messageOf(exit)).toContain('Tool edit is blocked in define_goal')
  })

  it('allows a tool for an agent with no mapped start state', async () => {
    const harness = makeHarness()
    await register(harness)

    const exit = await runHook(harness, { tool: 'edit', agent: 'build', sessionID: 'ses_unmapped' })

    expect(Exit.isSuccess(exit)).toBe(true)
  })

  it('refuses a gated tool when the session cannot be opened', async () => {
    const harness = makeHarness()
    harness.failStorageReads = true
    await register(harness)
    await harness.emit(sessionCreated('ses_1', 'rug'))

    const exit = await runHook(harness, { tool: 'edit', agent: 'rug', sessionID: 'ses_1' })

    expect(Exit.isFailure(exit)).toBe(true)
    expect(toolErrorOf(exit).metadata).toMatchObject({ code: 'tool_blocked', tool: 'edit' })
  })
})
