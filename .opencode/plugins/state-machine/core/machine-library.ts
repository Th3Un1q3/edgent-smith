import type { ActionFunction, GuardPredicate } from 'xstate'

import { DEFAULT_MACHINE } from '../machines'
import type { MachineModule } from '../machines'

import { assembleMachine } from './machine-assembly'
import type { EmitRequest, LoopDefinition, LoopEvent, MachineContext, StateMachineLibrary } from './machine-contract'
import { stateLeaf, stateValuePath } from './signals'
import type { PersistedSnapshot } from './snapshot'

type LoopActionMap = Record<string, ActionFunction<MachineContext, LoopEvent, LoopEvent, unknown, never, never, never, never, EmitRequest>>
type LoopGuardMap = Record<string, GuardPredicate<MachineContext, LoopEvent, unknown, never>>

/**
 * The one place the state library is named. The entry calls it under guard; the
 * rest of the module receives the result, so a broken install has one origin.
 */
export const loadStateMachineLibrary = async (module: MachineModule = DEFAULT_MACHINE): Promise<StateMachineLibrary> => {
  const { assign, createActor, emit, enqueueActions, not, setup, stateIn } = await import('xstate')

  const runtime = { assign, emit, enqueueActions, not, stateIn }

  const machine = setup({
    types: {
      context: {} as MachineContext,
      events: {} as LoopEvent,
      emitted: {} as EmitRequest,
    },
    actions: module.definitions.createActions(runtime, assembleMachine(module).sources) as unknown as LoopActionMap,
    guards: module.definitions.createGuards(runtime) as unknown as LoopGuardMap,
  })

  return {
    createActor: (loop, startState, context, restored) => {
      // The supplied definition reaches the library whole: only our `signals`
      // metadata is removed, so its root `on` and every other root key survive.
      const definition = structuredClone(loop) as LoopDefinition & { signals?: unknown }
      delete definition.signals
      const created = machine.createMachine({ ...definition, initial: startState, context })
      const candidate = restored === undefined
        ? undefined
        : createActor(created, { snapshot: { ...restored, context } as never })
      const isUsable = (value: typeof candidate): value is NonNullable<typeof candidate> =>
        value !== undefined && value.getSnapshot().status !== 'error'

      // A payload the library cannot place comes back as an error actor rather
      // than a throw, so the session falls back to its initial state here.
      const actor = isUsable(candidate) ? candidate : createActor(created)
      const emitted: EmitRequest[] = []

      actor.on('*', (event) => {
        emitted.push(event)
      })
      actor.start()

      return {
        send: event => actor.send(event),
        state: () => stateLeaf(actor.getSnapshot().value),
        statePath: () => stateValuePath(actor.getSnapshot().value),
        context: () => actor.getSnapshot().context,
        takeEmits: () => emitted.splice(0),
        persistedSnapshot: () => actor.getPersistedSnapshot() as PersistedSnapshot,
        restored: actor === candidate,
      }
    },
  }
}
