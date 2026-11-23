import type { MachineConfig, TransitionConfig } from 'xstate'
import type { PromptInput } from '@opencode/schema/prompt-input'
import type { AgentAttachment } from '@opencode/schema/prompt'
import type { SessionInbox } from '@opencode/schema/session-inbox'

import type { CallbackPayload, LoopContext } from '../machines/session/context'

import type { SignalSpec, SignalSources } from './signals'
import type { PersistedSnapshot, ToolPolicyRule } from './snapshot'

export type ActionSpec = {
  readonly type: string
  readonly params: unknown
}

export type GuardSpec = {
  readonly type: string
  readonly params: unknown
}

/**
The one-line description a prompt emit carries, or its opening words when the
emit supplies none.
*/
export const promptDescription = (emit: Pick<PromptEmit, 'text' | 'description'>): string =>
  emit.description !== undefined && emit.description !== ''
    ? emit.description
    : 'Sent synthetic message: ' + emit.text.slice(0, 20) + '...'

export type ToolSignal = string

export type LoopStateId = string

/**
Events the machine accepts from the host rather than from the model.
*/
export type LoopEventType = `agent_sent_signal.${string}` | 'system_idle' | 'system_user_input'
export const signalEvent = <S extends string>(signal: S): `agent_sent_signal.${S}` =>
  `agent_sent_signal.${signal}`
export const callbackEvent = <N extends CallbackName>(name: N): `callback.${N}` => `callback.${name}`

/**
A callback name a machine module declares; core carries it as an opaque string.
*/
export type CallbackName = string

/**
The context core manipulates: session identity and the two policies it installs,
plus whatever the machine module keeps in its own context.
*/
export type MachineContext = Record<string, unknown> & {
  readonly sessionId: string
  readonly agent: string
  policy?: ToolPolicyRule
  signalsPolicy?: SignalsPolicy
}

/**
The signals the current policy enables, in the order it set them. The policy is
machine state, not a per-state property, so a state that sets no policy keeps
the one already in force.
*/
export interface SignalsPolicy {
  readonly names: readonly string[]
}

/**
 * A state the loop passes through while it waits for a callback. Restoring into
 * one would leave the session waiting for a reply that no longer exists, so a
 * stored transient state is treated as absent and the loop starts at the
 * agent's start state instead. The module names its own transient states.
 */

/**
The loop's state and transition surface in the state library's own config types,
so a state naming an event the loop does not accept, or an arm carrying a key the
library would reject, fails the typecheck. The action and guard payloads stay
ours (`ActionSpec`, `GuardSpec`): naming the setup maps' parameterised types here
would need `setup` at module scope, and the lazy import exists so a broken
install has one origin.
*/
type NativeLoopConfig = MachineConfig<
  MachineContext,
  LoopEvent,
  never,
  ActionSpec,
  GuardSpec,
  never,
  string,
  unknown,
  unknown,
  EmitRequest
>

type NativeStateConfig = NonNullable<NonNullable<NativeLoopConfig['states']>[LoopStateId]>

type NativeTransitions = NonNullable<NativeStateConfig['on']>

export type LoopArm = TransitionConfig<
  MachineContext,
  LoopEvent,
  LoopEvent,
  never,
  ActionSpec,
  GuardSpec,
  never,
  EmitRequest
>

export type LoopOn = Readonly<{ [K in keyof NativeTransitions]: LoopArm | readonly LoopArm[] }>

export type LoopState = Omit<NativeStateConfig, 'entry' | 'exit' | 'on'> & {
  readonly entry?: readonly ActionSpec[]
  readonly exit?: readonly ActionSpec[]
  readonly on: LoopOn
}

export type LoopDefinition = Omit<NativeLoopConfig, 'context' | 'states'> & {
  readonly id: string
  readonly states: Readonly<Record<LoopStateId, LoopState>>
}

/**
What an action asks the outside world to do. The plugin delivers it: `emit.prompt`
becomes a synthetic message, `emit.shell` becomes a command whose result returns
through `callback.<reportTo>`.
*/
export interface PromptEmit {
  readonly type: 'emit.prompt'
  readonly text: string
  /**
  The line a person sees beside the message. Prompt actions supply one; an emit
  that omits it is named by its opening words.
  */
  readonly description?: string
}

export interface ShellEmit {
  readonly type: 'emit.shell'
  readonly cmd: string
  readonly reportTo: CallbackName
}

export interface DispatchEmit {
  readonly type: 'emit.dispatch'
  readonly agent: string
  readonly text: string
}

/**
A child run: the plugin creates it under the session, prompts it, and answers
`reportTo` with one payload for whatever happened to it, so a second spawn while
one is pending and an abandoned wait both settle rather than hang.
*/
export interface SubagentEmit {
  readonly type: 'emit.subagent'
  readonly agent: string
  readonly text: string
  readonly description: string
  readonly reportTo: CallbackName
  readonly timeoutMs: number
}

export interface SkillEmit {
  readonly type: 'emit.skill'
  readonly name: string
  readonly reportTo: CallbackName
}

export interface MemoriesEmit {
  readonly type: 'emit.memories'
  readonly namespace: string
  readonly reportTo: CallbackName
}

export interface SignalsEmit {
  readonly type: 'emit.signals'
  readonly signal_keys?: readonly string[]
}

/**
A command the live session runs by name. `text` is optional here because a command
may take none, while the client input requires a string the plugin fills with ''.
*/
export interface CommandEmit {
  readonly type: 'emit.command'
  readonly name: string
  readonly text?: string
  readonly files?: ReadonlyArray<PromptInput.FileAttachment>
  readonly agents?: ReadonlyArray<AgentAttachment>
  readonly skills?: ReadonlyArray<PromptInput.SkillAttachment>
  readonly delivery?: SessionInbox.Delivery
}

export type EmitRequest
  = | PromptEmit
    | ShellEmit
    | DispatchEmit
    | SubagentEmit
    | SkillEmit
    | MemoriesEmit
    | SignalsEmit
    | CommandEmit

export interface SessionMachine {
  readonly sessionId: string
  readonly agent: string
  readonly state: LoopStateId
  readonly context: LoopContext
}

export interface SignalRequest {
  /**
  A policy may enable a name the definition carries no arm for, so the event type
  is not limited to `TOOL_SIGNALS`.
  */
  readonly type: `agent_sent_signal.${string}`
  readonly payload?: unknown
}

export type CallbackEventType = `callback.${CallbackName}`

/**
Why the host stopped a turn. A provider failure is not an interruption: it keeps
the panic path, while a person taking control parks the loop.
*/
/**
The signal that ends a command's work. It is the only name that clears a pending
command, so the state waiting on the command can be the one that answers it.
*/
export const RETROSPECTIVE_COMPLETE = 'RETROSPECTIVE_COMPLETE'

export const INTERRUPT_REASONS = ['user', 'shutdown', 'superseded', 'inactivity'] as const
export type InterruptReason = (typeof INTERRUPT_REASONS)[number]

export interface SystemInterrupted {
  readonly type: 'system_interrupted'
  readonly reason: InterruptReason
}

export type LoopEvent
  = | SignalRequest
    | SystemInterrupted
    | { readonly type: 'system_idle' }
    | { readonly type: 'system_user_input', readonly text: string }
    | { readonly type: 'admit', readonly agent: string, readonly parentID?: string }
    | { readonly type: CallbackEventType, readonly payload: CallbackPayload }

/**
One started machine, as the state library exposes it. Emits are collected during
`send` and `start`, then drained by the caller, so the actor never performs I/O.
*/
export interface Actor {
  send: (event: LoopEvent) => void
  /**
  The leaf name every public surface reports, so a compound state reads `validate`.
  */
  state: () => LoopStateId
  /**
  The full dotted path, for a reader that must address a compound state.
  */
  statePath?: () => LoopStateId
  context: () => MachineContext
  takeEmits: () => readonly EmitRequest[]
  /**
  The state library's own persisted snapshot, stored verbatim so a restore
  replays the actor rather than a hand-built record.
  */
  persistedSnapshot: () => PersistedSnapshot
  /**
  False when a stored snapshot was refused and the actor started at the initial
  state instead.
  */
  readonly restored?: boolean
}

export interface StateMachineLibrary {
  /**
  A fourth argument restores the actor from a stored snapshot. The live context
  replaces the snapshot's before the library sees it, so a session identity is
  never taken from the record.
  */
  createActor: (
    loop: LoopDefinition,
    startState: LoopStateId,
    context: MachineContext,
    restored?: PersistedSnapshot,
  ) => Actor
}

/**
One machine module, assembled once: its definition in the state library's shape,
the signal registry its policies resolve against, and the declarations the
actions read.
*/
export interface AssembledMachine {
  readonly loop: LoopDefinition
  readonly registry: Readonly<Record<string, SignalSpec>>
  readonly sources: SignalSources
  readonly transientStates: ReadonlySet<string>
}
