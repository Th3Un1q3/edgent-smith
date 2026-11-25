import { Deferred, Effect, Logger } from 'effect'

import { describe, expect, it, vi } from 'vitest'

import { createStateMachinePlugin, createSubagentRunner } from '@plugins/state-machine'
import { loadStateMachineLibrary } from '@plugins/state-machine/core/machine'
import { DEFAULT_MACHINE } from '@plugins/state-machine/machines'

import { makeHarness, sessionCreated } from '@tests/helpers/state-machine/harness'

import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import type { CallbackPayload, SubagentEmit } from '@plugins/state-machine/core/machine'
import type { RunSubagent } from '@plugins/state-machine'
import type { Harness, SyntheticMessage } from '@tests/helpers/state-machine/harness'

interface CommandDefinition {
  states: {
    towards_goal: {
      states: {
        work: {
          entry: Array<{ type: string, params: Record<string, unknown> }>
        }
      }
    }
  }
}

/**
The session chart with one `run_command` on `work`, as a stage that refuses it waits there.
*/
const commandModule = (): typeof DEFAULT_MACHINE => {
  const definition = structuredClone(DEFAULT_MACHINE.definition) as CommandDefinition
  definition.states.towards_goal.states.work.entry.push({
    type: 'run_command',
    params: { name: 'retro', text: 'complete the loop' },
  })
  return { ...DEFAULT_MACHINE, definition }
}

const startPlugin = (harness: Harness, plugin: Plugin): void => {
  const collect = Logger.make<unknown, void>(({ message }) => {
    harness.logs.push(Array.isArray(message) ? message.map(String).join(' ') : String(message))
  })
  const running = Effect.scoped(Effect.flatMap(plugin.effect(harness.context), () => Effect.never))
  Effect.runFork(Effect.withLogger(running, collect))
}

const inWork = async (harness: Harness): Promise<void> => {
  await harness.emit(sessionCreated('ses_1', 'rug'))
  await harness.runTool({ type: 'SET_GOAL', payload: { goal: 'ship it' } }, 'ses_1')
  await harness.runTool({ type: 'PLAN_READY' }, 'ses_1')
}

const refusalPrompts = (harness: Harness): SyntheticMessage[] =>
  harness.synthetics.filter(message => message.text.includes('`retro`'))

const verdictPrompts = (harness: Harness): SyntheticMessage[] =>
  harness.synthetics.filter(message => message.text.startsWith('The validator reply was unreadable'))

const refusalText = (harness: Harness): string => refusalPrompts(harness)[0]?.text ?? ''

const verdictText = (harness: Harness): string => verdictPrompts(harness)[0]?.text ?? ''

describe('refused run_command', () => {
  it('prompts the session once with the refused command and the host reason', async () => {
    const harness = makeHarness()
    const module = commandModule()

    startPlugin(harness, createStateMachinePlugin(() => loadStateMachineLibrary(module), {
      machine: module,
      runShell: () => Effect.succeed({ ok: true, exitCode: 0, output: '' }),
      sendCommand: () => Effect.fail(new Error('Command.NotFoundError: retro')),
    }))
    await harness.ready()
    await inWork(harness)

    await vi.waitFor(() => {
      expect(refusalPrompts(harness)).toHaveLength(1)
    })

    expect(refusalText(harness)).toContain('was refused')
    expect(refusalText(harness)).toContain('Command.NotFoundError')
    expect(refusalText(harness)).toContain('cannot advance')
    expect(harness.logs.some(line => line.includes('emit.command refused'))).toBe(true)
  })
})

describe('unreadable subagent verdict', () => {
  it('prompts the parent once and keeps the recorded failure', async () => {
    const harness = makeHarness()
    const unreadable: RunSubagent = () => Effect.succeed({
      ok: false,
      output: 'verdict-unreadable: the judge reply had no JSON object',
    })

    startPlugin(harness, createStateMachinePlugin(() => loadStateMachineLibrary(DEFAULT_MACHINE), {
      machine: DEFAULT_MACHINE,
      runShell: () => Effect.succeed({ ok: true, exitCode: 0, output: '' }),
      runSubagent: unreadable,
    }))
    await harness.ready()
    await inWork(harness)
    await harness.runTool({ type: 'CLAIM_WORK' }, 'ses_1')

    await vi.waitFor(() => {
      expect(verdictPrompts(harness)).toHaveLength(1)
      expect(JSON.stringify(harness.storageWrites)).toContain('verdict-unreadable')
    })

    expect(verdictText(harness)).toContain('no JSON object')
  })
})

describe('subagent port verdict reading', () => {
  it('reports a reply with no JSON object as unreadable', async () => {
    const context = {
      session: {
        create: () => Effect.succeed({ id: 'ses_child_1' }),
        prompt: () => Effect.void,
        wait: () => Effect.succeed('plain reply with no json'),
      },
    } as unknown as Context
    const settled = Deferred.makeUnsafe<CallbackPayload>()
    const runner = createSubagentRunner(context)
    const emit: SubagentEmit = {
      type: 'emit.subagent',
      agent: 'judge',
      text: 'Judge whether the goal is met.',
      description: 'Spawn the judge.',
      reportTo: 'subagent_ready',
      timeoutMs: 1000,
    }

    await Effect.runPromise(Effect.gen(function* () {
      yield* runner.spawn('ses_1', emit, payload => Deferred.succeed(settled, payload).pipe(Effect.asVoid))

      const payload = yield* Deferred.await(settled)
      expect(payload.output).toContain('verdict-unreadable: plain reply with no json')
    }))
  })
})
