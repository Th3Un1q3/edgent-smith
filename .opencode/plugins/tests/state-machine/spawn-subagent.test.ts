import { Deferred, Effect } from 'effect'

import { describe, expect, it } from 'vitest'

import { createSubagentRunner, settleVerdict } from '@plugins/state-machine'

import { createStateMachine, loadStateMachineLibrary } from '@plugins/state-machine/core/machine'

import { DEFAULT_MACHINE } from '@plugins/state-machine/machines'

import { makeHarness, promptCalls } from '@tests/helpers/state-machine/harness'

import type { CallbackPayload, EmitRequest, StateMachine, SubagentEmit } from '@plugins/state-machine/core/machine'
import type { MachineModule } from '@plugins/state-machine/machines'
import type { Context } from '@opencode/plugin/effect/plugin'

/**
The child settles off the caller's fiber, so a test that asserts a verdict waits
on a signal the settle writes, never on `spawn` returning.
*/
const signalOf = <A>(): Deferred.Deferred<A> => Deferred.makeUnsafe<A>()

const judged = (verdict: 'pass' | 'fail', output: string): CallbackPayload => {
  const payload = { ok: verdict === 'pass', output, verdict }
  return payload
}

describe('spawn_subagent', () => {
  const enterValidate = async (module: MachineModule = DEFAULT_MACHINE): Promise<{ machine: StateMachine, emits: readonly EmitRequest[] }> => {
    const library = await loadStateMachineLibrary(module)
    const machine = createStateMachine({ library, machine: module })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    const emits = machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    return { machine, emits }
  }

  const inValidate = async (): Promise<StateMachine> => {
    const { machine } = await enterValidate()
    return machine
  }

  // The shipped declaration fixes the spawn text, so a test that needs a template
  // or a skills list patches that one action rather than rebuilding the builder.
  const withSpawn = (parameters: Record<string, unknown>): MachineModule => {
    const definition = structuredClone(DEFAULT_MACHINE.definition) as {
      states: {
        towards_goal: {
          states: {
            validate: { entry: Array<{ type: string, params: Record<string, unknown> }> }
          }
        }
      }
    }
    const entry = definition.states.towards_goal.states.validate.entry
    const spawn = entry.find(action => action.type === 'spawn_subagent')

    if (spawn === undefined) throw new Error('validate declares no spawn_subagent action')
    spawn.params = { ...spawn.params, ...parameters }
    return { ...DEFAULT_MACHINE, definition }
  }

  const spawnedOnEntry = async (parameters: Record<string, unknown>): Promise<SubagentEmit> => {
    const { emits } = await enterValidate(withSpawn(parameters))
    const spawn = emits.find((emit): emit is SubagentEmit => emit.type === 'emit.subagent')

    if (spawn === undefined) throw new Error('validate entry emits no spawn_subagent')
    return spawn
  }

  const judge = {
    type: 'emit.subagent' as const,
    agent: 'judge',
    text: 'Judge whether the goal is met.',
    description: 'Spawn the judge.',
    reportTo: 'subagent_ready' as const,
    timeoutMs: 120_000,
  }

  const forward = (settled: Deferred.Deferred<CallbackPayload>, machine?: StateMachine) =>
    (payload: CallbackPayload) => Effect.sync(() => {
      if (machine !== undefined) machine.callback('ses_1', 'subagent_ready', payload)
    }).pipe(Effect.andThen(Deferred.succeed(settled, payload)), Effect.asVoid)

  const drivenBy = (machine: StateMachine) => {
    const gate = signalOf<CallbackPayload>()
    const settled = signalOf<CallbackPayload>()
    const seen: CallbackPayload[] = []
    const runner = createSubagentRunner(makeHarness().context, () => Deferred.await(gate))
    const settle = (payload: CallbackPayload) => Effect.sync(() => {
      seen.push(payload)
      machine.callback('ses_1', 'subagent_ready', payload)
    }).pipe(Effect.andThen(Deferred.succeed(settled, payload)), Effect.asVoid)

    return { gate, runner, seen, settle, settled }
  }

  const expectState = (machine: StateMachine, state: string): void => {
    expect(machine.get('ses_1')?.state).toBe(state)
  }

  const expectNoReady = (machine: StateMachine): void => {
    expect(machine.get('ses_1')?.context.results.subagent_ready).toBeUndefined()
  }

  const expectReadyOk = (machine: StateMachine): void => {
    expect(machine.get('ses_1')?.context.results.subagent_ready?.ok).toBe(true)
  }

  const expectReadyOutput = (machine: StateMachine, output: string): void => {
    expect(machine.get('ses_1')?.context.results.subagent_ready?.output).toBe(output)
  }

  it('returns from the spawning event in validate with no verdict yet', async () => {
    const machine = await inValidate()
    const child = drivenBy(machine)

    const verdict = await Effect.runPromise(Effect.gen(function* () {
      yield* child.runner.spawn('ses_1', judge, child.settle)

      expect(machine.get('ses_1')?.state).toBe('validate')
      expect(child.seen).toEqual([])
      expect(machine.get('ses_1')?.context.results.subagent_ready).toBeUndefined()
      expect(child.runner.pending('ses_1')).toBe('ses_1')

      yield* Deferred.succeed(child.gate, { ok: true, output: 'the goal is met' })
      return yield* Deferred.await(child.settled)
    }))

    expect(verdict.ok).toBe(true)
    expect(machine.get('ses_1')?.state).toBe('memorize')
    expect(child.runner.pending('ses_1')).toBeUndefined()
  })

  it('takes the pass arm for a verdict delivered after the spawning event completed', async () => {
    const machine = await inValidate()
    const child = drivenBy(machine)

    await Effect.runPromise(Effect.gen(function* () {
      yield* child.runner.spawn('ses_1', judge, child.settle)

      expect(machine.get('ses_1')?.state).toBe('validate')

      yield* Deferred.succeed(child.gate, { ok: true, output: 'the goal is met' })
      yield* Deferred.await(child.settled)
    }))

    expectState(machine, 'memorize')
    expectReadyOk(machine)
  })

  it('takes the fail arm for a verdict delivered after the spawning event completed', async () => {
    const machine = await inValidate()
    const child = drivenBy(machine)

    await Effect.runPromise(Effect.gen(function* () {
      yield* child.runner.spawn('ses_1', judge, child.settle)

      expect(machine.get('ses_1')?.state).toBe('validate')

      yield* Deferred.succeed(child.gate, judged('fail', 'the change does not compile'))
      yield* Deferred.await(child.settled)
    }))

    expect(machine.get('ses_1')).toMatchObject({
      state: 'panic',
      context: {
        results: { subagent_ready: { output: 'the change does not compile' } },
        failure: { reason: 'subagent_ready failed' },
      },
    })
    expect(child.runner.pending('ses_1')).toBeUndefined()
  })

  it('refuses a second spawn while one is pending', async () => {
    const machine = await inValidate()
    const child = drivenBy(machine)
    const outputs: Array<string | undefined> = []

    await Effect.runPromise(Effect.gen(function* () {
      yield* child.runner.spawn('ses_1', judge, () => Effect.void)

      expect(child.runner.pending('ses_1')).toBe('ses_1')

      yield* child.runner.spawn('ses_1', judge, payload =>
        Effect.sync(() => { outputs.push(payload.output) }))
    }))

    expect(outputs).toEqual(['spawn-in-flight'])
  })

  it('records a timeout without panicking and leaves no pending spawn', async () => {
    const machine = await inValidate()
    const settled = signalOf<CallbackPayload>()
    const runner = createSubagentRunner(makeHarness().context, () => Effect.never)

    await Effect.runPromise(Effect.gen(function* () {
      yield* runner.spawn('ses_1', { ...judge, timeoutMs: 5 }, forward(settled, machine))
      yield* Deferred.await(settled)
    }))

    expect(runner.pending('ses_1')).toBeUndefined()
    expect(machine.get('ses_1')).toMatchObject({
      state: 'validate',
      context: {
        results: { subagent_ready: { output: 'timeout' } },
        failure: { reason: 'subagent_ready failed' },
      },
    })
  })

  it('refuses by name when the host supplies no session facility', async () => {
    const runner = createSubagentRunner({ session: {} } as unknown as Context)
    const settled = signalOf<CallbackPayload>()

    const verdict = await Effect.runPromise(Effect.gen(function* () {
      yield* runner.spawn('ses_1', judge, forward(settled))
      return yield* Deferred.await(settled)
    }))

    expect(verdict.output).toContain('spawn-failed: subagent-port-unavailable')
  })

  it('drops a verdict that arrives with no spawn in flight', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({ library })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')

    const emits = machine.callback('ses_1', 'subagent_ready', { ok: true })

    expect(emits).toEqual([])
    expect(machine.get('ses_1')?.state).toBe('work')
  })

  it('drops a verdict with no pending spawn while validate awaits one', async () => {
    const machine = await inValidate()

    const dropped = settleVerdict(
      (sessionId, reportTo, payload) => machine.callback(sessionId, reportTo, payload),
      undefined,
      'ses_1',
      'subagent_ready',
      { ok: true, output: 'the goal is met' },
    )

    expect(dropped).toEqual([])
    expectState(machine, 'validate')
    expectNoReady(machine)

    const live = await inValidate()
    const delivered = settleVerdict(
      (sessionId, reportTo, payload) => live.callback(sessionId, reportTo, payload),
      'ses_1',
      'ses_1',
      'subagent_ready',
      { ok: true, output: 'the goal is met' },
    )

    expect(delivered.length).toBeGreaterThan(0)
    expectState(live, 'memorize')
  })

  it('raises one spawn on entering validate, carrying the JSON verdict instruction', async () => {
    const library = await loadStateMachineLibrary()
    const machine = createStateMachine({ library })

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'PLAN_READY' }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    const emits = machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })
    const spawns = emits.filter(emit => emit.type === 'emit.subagent')
    const spawn = spawns[0] as { readonly agent?: string, readonly reportTo?: string, readonly text?: string }

    expect(machine.get('ses_1')?.state).toBe('validate')
    expect(spawns).toHaveLength(1)
    expect(spawn.agent).toBe('judge')
    expect(spawn.reportTo).toBe('subagent_ready')
    expect(spawn.text).toContain('{"verdict":"pass"|"fail"')
    expect(machine.get('ses_1')?.context.results.subagent_ready).toBeUndefined()
  })

  it('renders a spawn text template in the fixture scope instead of emitting the expression', async () => {
    const spawn = await spawnedOnEntry({ text: 'Judge whether ${context.goal} is met.' })

    expect(spawn.text).toBe('Judge whether ship it is met.')
    expect(spawn.text).not.toContain('${')
  })

  it('carries a spawn skills list to the child prompt as id attachments', async () => {
    const spawn = await spawnedOnEntry({ skills: ['progressive-validation'] })
    const settled = signalOf<CallbackPayload>()
    const runner = createSubagentRunner(makeHarness().context)

    expect(spawn.skills).toEqual(['progressive-validation'])

    await Effect.runPromise(Effect.gen(function* () {
      yield* runner.spawn('ses_1', spawn, forward(settled))
      yield* Deferred.await(settled)
    }))

    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0]).toStrictEqual({
      sessionID: 'ses_child_1',
      text: spawn.text,
      skills: [{ id: 'progressive-validation' }],
    })
  })

  it('prompts a spawn with no skills exactly as a plain text prompt', async () => {
    const spawn = await spawnedOnEntry({})
    const settled = signalOf<CallbackPayload>()
    const runner = createSubagentRunner(makeHarness().context)

    expect('skills' in spawn).toBe(false)

    await Effect.runPromise(Effect.gen(function* () {
      yield* runner.spawn('ses_1', spawn, forward(settled))
      yield* Deferred.await(settled)
    }))

    expect(promptCalls).toHaveLength(1)
    expect(promptCalls[0]).toStrictEqual({ sessionID: 'ses_child_1', text: spawn.text })
  })

  it('records an unavailable port without panicking or leaving validate', async () => {
    const machine = await inValidate()
    const settled = signalOf<CallbackPayload>()
    const runner = createSubagentRunner({ session: {} } as unknown as Context)

    await Effect.runPromise(Effect.gen(function* () {
      yield* runner.spawn('ses_1', judge, forward(settled, machine))
      yield* Deferred.await(settled)
    }))

    expect(machine.get('ses_1')).toMatchObject({
      state: 'validate',
      context: {
        results: { subagent_ready: { output: expect.stringContaining('subagent-port-unavailable') } },
        failure: { reason: 'subagent_ready failed' },
      },
    })
    expect(runner.pending('ses_1')).toBeUndefined()
  })

  it('refuses a second entry while a spawn is pending and keeps that spawn armed', async () => {
    const machine = await inValidate()
    const child = drivenBy(machine)
    const refusals: Array<string | undefined> = []

    await Effect.runPromise(Effect.gen(function* () {
      yield* child.runner.spawn('ses_1', judge, child.settle)
      yield* child.runner.spawn('ses_1', judge, payload =>
        Effect.sync(() => { refusals.push(payload.output) }))

      expect(refusals).toEqual(['spawn-in-flight'])
      expect(child.runner.pending('ses_1')).toBe('ses_1')

      yield* Deferred.succeed(child.gate, { ok: true, output: 'the goal is met' })
      yield* Deferred.await(child.settled)
    }))

    expectReadyOutput(machine, 'the goal is met')
    expectState(machine, 'memorize')
  })
})
