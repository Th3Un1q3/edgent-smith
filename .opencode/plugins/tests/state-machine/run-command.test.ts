import { Deferred, Effect } from 'effect'

import { describe, expect, it } from 'vitest'

import { createCommandRunner, createStateMachinePlugin, didCompleteOnSignal } from '@plugins/state-machine'

import { createStateMachine, loadStateMachineLibrary, RETROSPECTIVE_COMPLETE } from '@plugins/state-machine/core/machine'
import { DEFAULT_MACHINE } from '@plugins/state-machine/machines'

import { makeHarness, sessionCreated, sessionIdle } from '@tests/helpers/state-machine-harness'

import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import type { CommandEmit } from '@plugins/state-machine/core/machine'
import type { RunSubagent } from '@plugins/state-machine'
import type { Harness } from '@tests/helpers/state-machine-harness'

/**
The session chart with one added `run_command` entry on `work`, the completion
signal enabled there, and the facility left to the caller. The sibling owns the
production wiring; this fixture proves the action and the emit.
*/
interface CommandDefinition {
  states: {
    towards_goal: {
      states: {
        work: {
          entry: Array<{ type: string, params: Record<string, unknown> }>
          on: Record<string, unknown>
        }
      }
    }
  }
}

const commandModule = (): typeof DEFAULT_MACHINE => {
  const definition = structuredClone(DEFAULT_MACHINE.definition) as CommandDefinition
  const manifest = structuredClone(DEFAULT_MACHINE.manifest) as { signals: Record<string, unknown> }
  const work = definition.states.towards_goal.states.work
  const policy = work.entry.find(action => action.type === 'update_signals_policy')
  const enabled = policy?.params.set_enabled_signals as string[] | undefined

  work.entry.push({ type: 'run_command', params: { name: 'retro', text: 'complete the loop' } })
  work.on['agent_sent_signal.' + RETROSPECTIVE_COMPLETE] = { actions: [] }
  enabled?.push(RETROSPECTIVE_COMPLETE)
  manifest.signals[RETROSPECTIVE_COMPLETE] = {
    describe: 'Report that the command this session raised has finished.',
    schema: { description: 'Constrains nothing.' },
  }

  return { ...DEFAULT_MACHINE, definition, manifest }
}

const emitOf = (emits: readonly { readonly type: string }[]): CommandEmit => {
  const emit = emits.find(candidate => candidate.type === 'emit.command')
  const kinds = emits.map(candidate => candidate.type).join(',')

  if (emit === undefined) throw new Error('no emit.command in ' + kinds)

  return emit as CommandEmit
}

const command: CommandEmit = { type: 'emit.command', name: 'retro', text: 'complete the loop' }

const startPlugin = (harness: Harness, plugin: Plugin): void => {
  const running = Effect.scoped(Effect.flatMap(plugin.effect(harness.context), () => Effect.never))
  Effect.runFork(running)
}

const inWork = async (harness: Harness): Promise<void> => {
  await harness.emit(sessionCreated('ses_1', 'rug'))
  await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
}

describe('run_command', () => {
  it('raises a run_command emit with the command name and text', async () => {
    const module = commandModule()
    const machine = createStateMachine({ library: await loadStateMachineLibrary(module), machine: module })

    machine.start('ses_1', 'rug')
    const result = machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')

    expect(emitOf(result.emits)).toEqual(command)
    expect(machine.get('ses_1')?.state).toBe('work')
  })

  it('sends the emit through the host command facility with the session id', async () => {
    const sent = Deferred.makeUnsafe<Record<string, unknown>>()
    const context = {
      session: { command: (input: Record<string, unknown>) => Deferred.succeed(sent, input) },
    } as unknown as Context
    const commands = createCommandRunner(context)

    await Effect.runPromise(Effect.gen(function* () {
      expect(yield* commands.raise('ses_1', command)).toEqual({ ok: true })
      expect(yield* Deferred.await(sent)).toEqual({
        sessionID: 'ses_1',
        name: 'retro',
        text: 'complete the loop',
        files: undefined,
        agents: undefined,
        skills: undefined,
        delivery: undefined,
      })
    }))
  })

  it('refuses a raise by name when the host supplies no command facility', async () => {
    const commands = createCommandRunner({ session: {} } as unknown as Context)

    const raised = await Effect.runPromise(commands.raise('ses_1', command))

    expect(raised).toEqual({ ok: false, output: 'command-port-unavailable: session.command' })
    expect(commands.isPending('ses_1')).toBe(false)
  })

  it('refuses a second raise while a command is pending and clears only on RETROSPECTIVE_COMPLETE', async () => {
    const gate = Deferred.makeUnsafe<void>()
    const context = { session: { command: () => Deferred.await(gate) } } as unknown as Context
    const commands = createCommandRunner(context)

    await Effect.runPromise(Effect.gen(function* () {
      expect(yield* commands.raise('ses_1', command)).toEqual({ ok: true })
      expect(yield* commands.raise('ses_1', command)).toEqual({ ok: false, output: 'command-in-flight' })

      expect(didCompleteOnSignal(commands, 'ses_1', 'CLAIM_WORK')).toBe(false)
      expect(commands.isPending('ses_1')).toBe(true)

      expect(didCompleteOnSignal(commands, 'ses_1', RETROSPECTIVE_COMPLETE)).toBe(true)
      expect(commands.isPending('ses_1')).toBe(false)
    }))
  })

  it('reaches the target state before the command completes', async () => {
    const module = commandModule()
    const machine = createStateMachine({ library: await loadStateMachineLibrary(module), machine: module })
    const gate = Deferred.makeUnsafe<void>()
    const context = { session: { command: () => Deferred.await(gate) } } as unknown as Context
    const commands = createCommandRunner(context)

    machine.start('ses_1', 'rug')
    const goal = machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    const raised = commands.raise('ses_1', emitOf(goal.emits))

    expect(machine.get('ses_1')?.state).toBe('work')
    expect(await Effect.runPromise(raised)).toEqual({ ok: true })
    expect(machine.get('ses_1')?.state).toBe('work')
    expect(commands.isPending('ses_1')).toBe(true)
  })

  it('dispatches an idle to the machine while a command is pending', async () => {
    const harness = makeHarness()
    const gate = Deferred.makeUnsafe<void>()

    const module = commandModule()

    startPlugin(harness, createStateMachinePlugin(() => loadStateMachineLibrary(module), {
      machine: module,
      sendCommand: () => Deferred.await(gate),
    }))
    await harness.ready()
    await inWork(harness)

    await harness.emit(sessionIdle('ses_1'))

    const nudge = harness.synthetics.find(message => message.text.includes('idle in `work`'))

    expect(nudge?.text).toContain('CLAIM_WORK')
    expect(harness.synthetics.some(message => message.text.includes('Verdict'))).toBe(false)
    expect(nudge?.text).toContain('act rather than stop')
  })

  it('moves to panic on the fourth idle of a round', async () => {
    const harness = makeHarness()
    const module = commandModule()

    startPlugin(harness, createStateMachinePlugin(() => loadStateMachineLibrary(module), {
      machine: module,
      sendCommand: () => Effect.never,
    }))
    await harness.ready()
    await inWork(harness)

    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))
    await harness.emit(sessionIdle('ses_1'))

    expect(harness.synthetics.filter(message => message.text.includes('idle in `work`'))).toHaveLength(3)
    expect(harness.synthetics.some(message => message.text.includes('idle budget exhausted'))).toBe(true)
  })

  it('dispatches an idle while a spawn is pending instead of holding it', async () => {
    const harness = makeHarness()
    const module = DEFAULT_MACHINE
    const spawned = Deferred.makeUnsafe<void>()
    const release = Deferred.makeUnsafe<{ ok: boolean, output?: string }>()
    let spawns = 0

    const runSubagent: RunSubagent = () => Effect.gen(function* () {
      spawns += 1

      yield* Deferred.succeed(spawned, undefined)
      return yield* Deferred.await(release)
    })

    // The quality check answers from the port, so CLAIM_WORK reaches validate and
    // its spawn starts; the spawn then stays pending on `release` while the idle runs.
    startPlugin(harness, createStateMachinePlugin(() => loadStateMachineLibrary(module), {
      machine: module,
      runShell: () => Effect.succeed({ ok: true, exitCode: 0, output: '' }),
      runSubagent,
    }))
    await harness.ready()
    await inWork(harness)

    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')
    await Effect.runPromise(Deferred.await(spawned))

    await harness.emit(sessionIdle('ses_1'))

    const nudges = harness.synthetics.filter(message => message.text.includes('idle in `validate`'))

    expect(nudges).toHaveLength(1)
    expect(nudges[0]?.text).toContain('act rather than stop')
    expect(harness.synthetics.some(message => message.text.includes('idle budget exhausted'))).toBe(false)
    expect(spawns, 'one idle must not start a second child while one is in flight').toBe(1)

    await Effect.runPromise(Deferred.succeed(release, { ok: true, output: 'settled after the assertions' }))
  })

  it('inserts retrospective after memorize: one command raise, idle nudges, completion reaches memorize\'s target', async () => {
    const machine = createStateMachine({ library: await loadStateMachineLibrary(DEFAULT_MACHINE), machine: DEFAULT_MACHINE })
    const gate = Deferred.makeUnsafe<void>()
    const commands = createCommandRunner({ session: { command: () => Deferred.await(gate) } } as unknown as Context)

    machine.start('ses_1', 'rug')
    machine.signal({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
    machine.signal({ type: 'CLAIM_WORK' }, 'ses_1')
    machine.callback('ses_1', 'quality_check_ready', { ok: true, exitCode: 0 })

    machine.signal({ type: RETROSPECTIVE_COMPLETE }, 'ses_1')
    expect(machine.get('ses_1')?.state).toBe('validate')

    machine.signal({ type: 'GOAL_ACHIEVED' }, 'ses_1')
    const entered = machine.signal({ type: 'LESSON', payload: { text: 'read the line' } }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('retrospective')
    const command = emitOf(entered.emits)

    expect(command).toEqual({ type: 'emit.command', name: 'retrospective' })
    expect(entered.emits.filter(emit => emit.type === 'emit.command')).toHaveLength(1)

    expect(await Effect.runPromise(commands.raise('ses_1', command))).toEqual({ ok: true })
    expect(await Effect.runPromise(commands.raise('ses_1', command))).toEqual({ ok: false, output: 'command-in-flight' })

    machine.idle('ses_1')
    expect(machine.get('ses_1')?.state).toBe('retrospective')

    machine.signal({ type: RETROSPECTIVE_COMPLETE }, 'ses_1')

    expect(machine.get('ses_1')?.state).toBe('parked')
  })
})
