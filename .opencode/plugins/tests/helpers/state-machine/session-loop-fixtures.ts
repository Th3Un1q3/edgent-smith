import { Exit, Option } from 'effect'

import { createStateMachine, loadStateMachineLibrary, SESSION_LOOP } from '@plugins/state-machine/core/machine'

import { makeHarness, register } from '@tests/helpers/state-machine/harness'

import type { EmitRequest, LoopState, StateMachine } from '@plugins/state-machine/core/machine'
import type { Harness } from '@tests/helpers/state-machine/harness'

export const boot = async (): Promise<Harness> => {
  const harness = makeHarness()

  await register(harness)
  return harness
}

export const createLoopMachine = async (): Promise<StateMachine> => {
  const library = await loadStateMachineLibrary()

  return createStateMachine({ library })
}

const TEXT_EMIT_TYPES: ReadonlySet<string> = new Set(['emit.prompt', 'emit.dispatch'])

const isTextEmit = (emitted: EmitRequest): emitted is Extract<EmitRequest, { type: 'emit.prompt' | 'emit.dispatch' }> =>
  TEXT_EMIT_TYPES.has(emitted.type)

export const emittedText = (emits: readonly EmitRequest[]): string => {
  const emitted = emits[0]

  return emitted !== undefined && isTextEmit(emitted)
    ? emitted.text
    : ''
}

export const content = (exit: Exit.Exit<unknown, unknown>): string => {
  if (!Exit.isSuccess(exit)) throw new Error('tool call failed')
  return (exit.value as { content: string }).content
}

export interface ToolFailure {
  readonly message: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export const failureOf = (exit: Exit.Exit<unknown, unknown>): ToolFailure => {
  if (Exit.isSuccess(exit)) throw new Error('expected a failed tool call')

  const error = Exit.findErrorOption(exit)

  if (Option.isNone(error)) throw new Error('expected a typed tool error')

  return error.value as ToolFailure
}

export const stateAt = (path: string): LoopState => {
  const [root, child] = path.split('.') as [string, string | undefined]
  const node = SESSION_LOOP.states[root] as LoopState
  return child === undefined ? node : (node.states as Readonly<Record<string, LoopState>> | undefined)?.[child] as LoopState
}

export const acceptedSignals = (path: string): string[] =>
  Object.keys(stateAt(path).on ?? {})
    .filter(event => event.startsWith('agent_sent_signal.'))
    .map(event => event.slice('agent_sent_signal.'.length))

export const VALIDATOR_PROMPT = 'Ask the agent to judge whether the goal is met.'
export const GOAL_REQUEST = 'Ask the agent what goal this session should accomplish.'
export const WORK_PROMPT = 'Remind the agent of the goal and the memories to work from.'
