import type {
  CallbackName,
  CommandEmit,
  LoopStateId,
} from '../../core/machine'

import type { TemplateId } from './template-files'

export type PromptTemplate = { readonly template: TemplateId }

/**
A prompt names one of the templates, carries a literal line, or both. A literal
`text` is delivered verbatim and wins over `template`; an entry with neither is
a defect the action refuses when it runs.
*/
export type PromptParameters
  = | (PromptTemplate & { readonly description: string, readonly text?: string })
    | { readonly description: string, readonly text: string }

export type RecordSource
  = | { readonly from: 'payload', readonly field: string }
    | { readonly from: 'literal', readonly value: string | number }

export type RecordParameters
  = | { readonly op: 'set', readonly key: 'goal' | 'attempts' | 'intent' | 'nudges', readonly source: RecordSource }
    | { readonly op: 'increment', readonly key: 'attempts' | 'nudges' }
    | { readonly op: 'push', readonly key: 'memories' | 'improvements', readonly source: RecordSource }
    | { readonly op: 'fail', readonly reason: string, readonly detail?: string }

export interface RunShellParameters {
  readonly cmd: string
  readonly reportTo: CallbackName
}

/**
`run_command` carries the session command input without the id, which the plugin
fills from the session the emit was raised in.
*/
export type RunCommandParameters = Omit<CommandEmit, 'type'>

/**
The child a spawn runs, the line shown beside it, and where its verdict returns.
A literal `text` is delivered verbatim and wins over `template`, exactly as
`prompt` reads its parameters; an entry carrying neither refuses when it runs.
*/
export interface SpawnSubagentFields {
  readonly agent: string
  readonly description: string
  readonly reportTo?: CallbackName
  readonly timeoutMs?: number
}

export type SpawnSubagentParameters
  = | (PromptTemplate & SpawnSubagentFields & { readonly text?: string })
    | ({ readonly text: string } & SpawnSubagentFields)

/**
The callback every spawn's verdict arrives under. One name per purpose: the
payload says whether it passed, not the name.
*/
export const SUBAGENT_READY: CallbackName = 'subagent_ready'

/**
The abandonment window a spawn's `timeoutMs` cannot exceed.
*/
export const SUBAGENT_TIMEOUT_MS = 120_000

export interface ActivateSkillParameters {
  readonly name: string
}

export interface RecallMemoriesParameters {
  readonly namespace: string
}

/**
One signal the policy adds that the manifest does not name: its prose, and the
manifest signal whose payload codec it reuses.
*/
export interface AdHocSignal {
  readonly description: string
  readonly schema?: string
}

/**
A policy entry: a manifest signal by name, or one object mapping a new name to
its description and an optional manifest signal whose codec validates it.
*/
export type EnabledSignal = string | Readonly<Record<string, AdHocSignal>>

export interface UpdateSignalsPolicyParameters {
  readonly set_enabled_signals: readonly EnabledSignal[]
}

export interface MarkSkillParameters {
  readonly name: string
}

export interface RecordCallbackParameters {
  readonly reportTo: CallbackName
  readonly key?: string
}

/**
The rule a state installs on entry and clears on exit: the tool names it allows
and the message the gate shows for any other tool. `allowedTools: null` clears
the rule instead.
*/
export type ToolsPolicyParameters
  = | { readonly stateId: LoopStateId, readonly allowedTools: readonly string[], readonly errorMessage: string }
    | { readonly allowedTools: null }

export type ActionSpec
  = | { readonly type: 'prompt', readonly params: PromptParameters }
    | { readonly type: 'record', readonly params: RecordParameters }
    | { readonly type: 'run_shell', readonly params: RunShellParameters }
    | { readonly type: 'run_command', readonly params: RunCommandParameters }
    | { readonly type: 'spawn_subagent', readonly params: SpawnSubagentParameters }
    | { readonly type: 'activate_skill', readonly params: ActivateSkillParameters }
    | { readonly type: 'recall_memories', readonly params: RecallMemoriesParameters }
    | { readonly type: 'update_signals_policy', readonly params: UpdateSignalsPolicyParameters }
    | { readonly type: 'record_callback', readonly params: RecordCallbackParameters }
    | { readonly type: 'mark_skill', readonly params: MarkSkillParameters }
    | { readonly type: 'set_tools_policy', readonly params: ToolsPolicyParameters }
    | { readonly type: 'admit_identity', readonly params: Record<string, never> }
    | { readonly type: 'emit_parent', readonly params: EmitParentParameters }

export interface EmitParentParameters {
  readonly type: string
}

export interface CounterBelowParameters {
  readonly key: 'attempts' | 'nudges'
  readonly limit: number | { readonly fromContext: 'maxAttempts' }
}

export interface FieldPresentParameters {
  readonly field: 'goal' | 'text' | 'verdict'
}

export interface SessionAgentParameters {
  readonly in: readonly string[]
}

export type GuardSpec
  = | { readonly type: 'counter_below', readonly params: CounterBelowParameters }
    | { readonly type: 'field_present', readonly params: FieldPresentParameters }
    | { readonly type: 'improvement_lesson', readonly params: unknown }
    | { readonly type: 'callback_ok', readonly params: unknown }
    | { readonly type: 'not_parked', readonly params: unknown }
    | { readonly type: 'session_agent', readonly params: SessionAgentParameters }

export const ACTION_TYPES = [
  'prompt',
  'record',
  'run_shell',
  'run_command',
  'spawn_subagent',
  'activate_skill',
  'recall_memories',
  'update_signals_policy',
  'record_callback',
  'mark_skill',
  'set_tools_policy',
  'admit_identity',
  'emit_parent',
] as const

export type ActionType = (typeof ACTION_TYPES)[number]

export const GUARD_TYPES = [
  'counter_below',
  'field_present',
  'improvement_lesson',
  'callback_ok',
  'not_parked',
  'session_agent',
] as const

export type GuardType = (typeof GUARD_TYPES)[number]

/**
The library surface this module needs. `machine.ts` keeps the single lazy
`import('xstate')` and hands the functions over, so a broken install has one origin.
*/
export type XStateRuntime = Pick<typeof import('xstate'), 'assign' | 'emit' | 'enqueueActions' | 'not' | 'stateIn'>

/**
The actor's own snapshot: a prompt runs inside the active child, so the leaf state it names comes from there.
*/
export interface ActorSelf {
  getSnapshot(): { readonly value: unknown }
}
