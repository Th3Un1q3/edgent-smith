import type { CommandEmit, LoopContext, LoopEvent, PromptEmit, SubagentEmit } from '../../core/machine'
import { skillKey } from '../../core/memory'

import { SUBAGENT_READY, SUBAGENT_TIMEOUT_MS } from './definition-contract'
import type {
  ActionType,
  ActorSelf,
  EmitParentParameters,
  PromptParameters,
  RecallMemoriesParameters,
  RecordCallbackParameters,
  RecordParameters,
  RunCommandParameters,
  RunShellParameters,
  SpawnSubagentParameters,
  ToolsPolicyParameters,
  UpdateSignalsPolicyParameters,
  XStateRuntime,
} from './definition-contract'
import { leafState } from './payload-readers'
import { renderPromptText } from './prompt-template'
import { applyRecord, applyRecordCallback } from './record-actions'
import type { SignalSources } from './signal-specs'
import { updateSignalsPolicySpecs } from './signal-specs'

/**
The part of the collect-actions argument `update_signals_policy` reads.
*/
interface SignalsPolicyArguments {
  readonly enqueue: {
    assign: (assigner: Partial<LoopContext>) => void
    emit: (event: { readonly type: string, readonly signal_keys?: readonly string[] }) => void
  }
}

/**
The part of the collect-actions argument `prompt` reads. It emits the text and,
when it names skills, records them.
*/
interface PromptArguments {
  readonly context: LoopContext
  readonly self: ActorSelf
  readonly enqueue: {
    assign: (assigner: Partial<LoopContext>) => void
    emit: (event: PromptEmit) => void
  }
}

/**
The part of the collect-actions argument `spawn_subagent` reads: the same
render scope `prompt` uses, so a spawn's text resolves the same expressions.
*/
interface SpawnArguments {
  readonly context: LoopContext
  readonly self: ActorSelf
}

/**
The part of the collect-actions argument `emit_parent` reads. The enqueue object
already carries `raise`, so the event stays on the library's internal queue.
*/
interface ParentRaiseArguments {
  readonly enqueue: { raise(event: { readonly type: string }): void }
}

const unrecordedSkills = (current: readonly string[], names: readonly string[]): string[] =>
  names.map(name => skillKey(name)).filter(key => !current.includes(key))

const promptEmit = (parameters: PromptParameters, context: LoopContext, state: string): PromptEmit => {
  const skills = parameters.skills

  return {
    type: 'emit.prompt',
    text: renderPromptText(parameters.text, { context, state }),
    description: parameters.description,
    ...(skills !== undefined && { skills }),
  }
}

const withSkills = (skills: readonly string[] | undefined): Pick<SubagentEmit, 'skills'> =>
  skills === undefined ? {} : { skills }

const subagentEmit = (parameters: SpawnSubagentParameters, context: LoopContext, state: string): SubagentEmit => ({
  type: 'emit.subagent',
  agent: parameters.agent,
  text: renderPromptText(parameters.text, { context, state }),
  description: parameters.description,
  ...withSkills(parameters.skills),
  reportTo: parameters.reportTo ?? SUBAGENT_READY,
  timeoutMs: Math.min(parameters.timeoutMs ?? SUBAGENT_TIMEOUT_MS, SUBAGENT_TIMEOUT_MS),
})

export const createActions = (runtime: XStateRuntime, sources: SignalSources) => ({
  prompt: runtime.enqueueActions(({ context, self, enqueue }: PromptArguments, parameters: PromptParameters) => {
    enqueue.emit(promptEmit(parameters, context, leafState(self)))

    const unrecorded = unrecordedSkills(context.injectedSkills, parameters.skills ?? [])

    if (unrecorded.length > 0) enqueue.assign({ injectedSkills: [...context.injectedSkills, ...unrecorded] })
  }),
  record: runtime.assign(({ context, event }: { context: LoopContext, event: LoopEvent }, parameters: RecordParameters) =>
    applyRecord(context, event, parameters)),
  run_shell: runtime.emit((_arguments, parameters: RunShellParameters) => ({
    type: 'emit.shell' as const,
    cmd: parameters.cmd,
    reportTo: parameters.reportTo,
  })),
  /**
  The return annotation is the check that the emit is a `CommandEmit`; the host's
  command facility is its only reader.
  */
  run_command: runtime.emit((_arguments, parameters: RunCommandParameters): CommandEmit => ({
    type: 'emit.command',
    ...parameters,
  })),
  spawn_subagent: runtime.emit(({ context, self }: SpawnArguments, parameters: SpawnSubagentParameters) =>
    subagentEmit(parameters, context, leafState(self))),
  recall_memories: runtime.emit((_arguments, parameters: RecallMemoriesParameters) => ({
    type: 'emit.memories' as const,
    namespace: parameters.namespace,
    reportTo: 'memories_ready' as const,
  })),
  update_signals_policy: runtime.enqueueActions(({ enqueue }: SignalsPolicyArguments, parameters: UpdateSignalsPolicyParameters) => {
    const names = Object.keys(updateSignalsPolicySpecs(parameters, sources))

    enqueue.emit({ type: 'emit.signals' as const, signal_keys: names })

    enqueue.assign({ signalsPolicy: { names } })
  }),
  record_callback: runtime.assign(({ context, event }: { context: LoopContext, event: LoopEvent }, parameters: RecordCallbackParameters) =>
    applyRecordCallback(context, event, parameters)),
  set_tools_policy: runtime.assign(({ context }: { context: LoopContext }, parameters: ToolsPolicyParameters) => {
    if (parameters.allowedTools === null) return { policy: undefined }

    // A restored session's snapshot rule wins; this fills a record that predates it.
    return context.policy === undefined
      ? {
          policy: {
            stateId: parameters.stateId,
            errorMessage: parameters.errorMessage,
            allowedTools: [...parameters.allowedTools],
          },
        }
      : {}
  }),
  admit_identity: runtime.assign(({ event }: { event: LoopEvent }) =>
    event.type === 'admit' ? { agent: event.agent, parentID: event.parentID } : {}),
  /**
  A child cannot move its parent, so it queues the event the parent declares:
  `raise` leaves the event on the internal queue the same macrostep drains.
  */
  emit_parent: runtime.enqueueActions(({ enqueue }: ParentRaiseArguments, parameters: EmitParentParameters) => {
    enqueue.raise({ type: parameters.type })
  }),
}) satisfies Record<ActionType, unknown>
