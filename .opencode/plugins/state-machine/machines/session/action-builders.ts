import type { CallbackName, CommandEmit, LoopContext, LoopEvent } from '../../core/machine'
import { skillKey } from '../../core/memory'

import { SUBAGENT_READY, SUBAGENT_TIMEOUT_MS } from './definition-contract'
import type {
  ActivateSkillParameters,
  ActionType,
  ActorSelf,
  EmitParentParameters,
  MarkSkillParameters,
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
import { renderPrompt } from './prompt-templates'
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
The part of the collect-actions argument `activate_skill` reads. Outside `setup`
nothing supplies the context type, so it is named here.
*/
interface SkillArguments {
  readonly context: LoopContext
  readonly enqueue: {
    emit(event: { readonly type: string, readonly name: string, readonly reportTo: CallbackName }): void
  }
}

/**
The part of the collect-actions argument `emit_parent` reads. The enqueue object
already carries `raise`, so the event stays on the library's internal queue.
*/
interface ParentRaiseArguments {
  readonly enqueue: { raise(event: { readonly type: string }): void }
}

export const createActions = (runtime: XStateRuntime, sources: SignalSources) => ({
  prompt: runtime.emit(({ context, self }: { context: LoopContext, self: ActorSelf }, parameters: PromptParameters) => ({
    type: 'emit.prompt' as const,
    text: renderPrompt(parameters, context, leafState(self)),
    description: parameters.description,
  })),
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
  spawn_subagent: runtime.emit(({ context }: { context: LoopContext }, parameters: SpawnSubagentParameters) => ({
    type: 'emit.subagent' as const,
    agent: parameters.agent,
    text: renderPrompt(parameters, context),
    description: parameters.description,
    reportTo: parameters.reportTo ?? SUBAGENT_READY,
    timeoutMs: Math.min(parameters.timeoutMs ?? SUBAGENT_TIMEOUT_MS, SUBAGENT_TIMEOUT_MS),
  })),
  activate_skill: runtime.enqueueActions(({ context, enqueue }: SkillArguments, parameters: ActivateSkillParameters) => {
    if (context.injectedSkills.includes(skillKey(parameters.name))) return

    enqueue.emit({ type: 'emit.skill', name: parameters.name, reportTo: 'skill_ready' })
  }),
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
  mark_skill: runtime.assign(({ context }: { context: LoopContext }, parameters: MarkSkillParameters) => ({
    injectedSkills: context.injectedSkills.includes(skillKey(parameters.name))
      ? context.injectedSkills
      : [...context.injectedSkills, skillKey(parameters.name)],
  })),
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
