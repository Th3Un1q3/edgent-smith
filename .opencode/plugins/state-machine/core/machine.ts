/**
 * The session state machine: one cohesive module for the loop, the machines, and
 * the messages they send. The entry file only registers this with opencode.
 */
import { Deferred, Effect, Schema } from 'effect'
import type { MachineConfig, TransitionConfig } from 'xstate'

import { skillKey } from './memory'
import { assertSignalDeclarations, refusalMessage, renderSignals, TOOL_SIGNALS, validateSignal } from './signals'
import type { SignalRefusal, SignalSpec, ToolSignal } from './signals'
import type { SessionSnapshot, SnapshotStore, ToolPolicyRule } from './snapshot'

export { TOOL_SIGNALS } from './signals'
export type { ToolSignal } from './signals'

export const LOOP_STATE_IDS = ['define_goal', 'work', 'check', 'validate', 'memorize', 'parked', 'panic'] as const
export type LoopStateId = (typeof LOOP_STATE_IDS)[number]

/**
Events the machine accepts from the host rather than from the model.
*/
export type LoopEventType = `agent_sent_signal.${ToolSignal}` | 'system_idle' | 'system_user_input'
export const signalEvent = <S extends ToolSignal>(signal: S): `agent_sent_signal.${S}` =>
  `agent_sent_signal.${signal}`
export const callbackEvent = <N extends CallbackName>(name: N): `callback.${N}` => `callback.${name}`

/**
Idle follow-ups allowed before the loop parks itself for debugging.
*/
export const MAX_IDLE_FOLLOW_UPS = 3

/**
Incomplete goals allowed before the loop escalates to `panic`.
*/
export const MAX_ATTEMPTS = 3

/**
Lessons kept in `memories`; the oldest drop first.
*/
export const MEMORY_LIMIT = 20

export type CallbackName = 'quality_check_ready' | 'skill_ready' | 'memories_ready'
export type IntentKind = 'none' | 'improvement' | 'lesson'

export interface InjectedMemories {
  readonly full: readonly string[]
  readonly index: readonly string[]
}

export interface CallbackPayload {
  readonly ok: boolean
  readonly exitCode?: number
  readonly output?: string
  readonly value?: InjectedMemories
}

export interface Failure {
  readonly reason: string
  readonly detail?: string
}

export interface LoopContext {
  readonly sessionId: string
  readonly agent: string
  readonly maxAttempts: number
  readonly memoryLimit: number
  goal: string
  intent: IntentKind
  attempts: number
  idleCount: number
  memories: string[]
  improvements: string[]
  injectedSkills: string[]
  injected: Record<string, InjectedMemories>
  results: Record<string, CallbackPayload>
  policy?: ToolPolicyRule
  failure?: Failure
}

/**
 * A state the loop passes through while it waits for a callback. Restoring into
 * one would leave the session waiting for a reply that no longer exists, so a
 * stored transient state is treated as absent and the loop starts at the
 * agent's start state instead.
 */
const TRANSIENT_STATES: ReadonlySet<LoopStateId> = new Set(['check'])

export type TemplateId
  = | 'goal_request'
    | 'state_follow_up'
    | 'idle_park'
    | 'quality_check_failed'
    | 'validation_self_report'
    | 'memorize'
    | 'panic_escalation'
    | 'park_summary'
    | 'work_towards_goal'

export type PromptTemplate
  = | { readonly template: 'goal_request' }
    | { readonly template: 'state_follow_up', readonly state: LoopStateId }
    | { readonly template: 'idle_park' }
    | { readonly template: 'quality_check_failed' }
    | { readonly template: 'validation_self_report' }
    | { readonly template: 'memorize' }
    | { readonly template: 'panic_escalation' }
    | { readonly template: 'park_summary' }
    | { readonly template: 'work_towards_goal' }

export type PromptParameters = PromptTemplate & { readonly description: string }

export type RecordSource
  = | { readonly from: 'payload', readonly field: string }
    | { readonly from: 'literal', readonly value: string | number }

export type RecordParameters
  = | { readonly op: 'set', readonly key: 'goal' | 'attempts' | 'idleCount' | 'intent', readonly source: RecordSource }
    | { readonly op: 'increment', readonly key: 'attempts' | 'idleCount' }
    | { readonly op: 'push', readonly key: 'memories' | 'improvements', readonly source: RecordSource }

export interface ShellParameters {
  readonly cmd: string
  readonly reportTo: CallbackName
}

export interface DispatchParameters {
  readonly agent: string
}

export interface SkillParameters {
  readonly name: string
}

export interface MemoriesParameters {
  readonly namespace: string
}

export interface DisplaySignalsParameters {
  readonly signal_keys?: readonly ToolSignal[]
}

export interface MarkSkillParameters {
  readonly name: string
}

export interface RecordCallbackParameters {
  readonly reportTo: CallbackName
  readonly key?: string
}

export interface FailParameters {
  readonly reason: string
  readonly detail?: string
}

/**
The rule a state installs on entry and clears on exit: the tool names it allows
and the message the gate shows for any other tool.
*/
export interface ToolsPolicyParameters {
  readonly stateId: LoopStateId
  readonly allowedTools: readonly string[]
  readonly errorMessage: string
}

export type ActionSpec
  = | { readonly type: 'prompt', readonly params: PromptParameters }
    | { readonly type: 'record', readonly params: RecordParameters }
    | { readonly type: 'request_shell', readonly params: ShellParameters }
    | { readonly type: 'request_dispatch', readonly params: DispatchParameters }
    | { readonly type: 'request_skill', readonly params: SkillParameters }
    | { readonly type: 'request_memories', readonly params: MemoriesParameters }
    | { readonly type: 'display_signals', readonly params: DisplaySignalsParameters }
    | { readonly type: 'record_callback', readonly params: RecordCallbackParameters }
    | { readonly type: 'mark_skill', readonly params: MarkSkillParameters }
    | { readonly type: 'set_tools_policy', readonly params: ToolsPolicyParameters }
    | { readonly type: 'clear_tools_policy', readonly params: Record<string, never> }
    | { readonly type: 'fail', readonly params: FailParameters }

export interface CounterBelowParameters {
  readonly key: 'idleCount' | 'attempts'
  readonly limit: number | { readonly fromContext: 'maxAttempts' }
}

export interface FieldPresentParameters {
  readonly field: 'goal' | 'text'
}

export type GuardSpec
  = | { readonly type: 'counter_below', readonly params: CounterBelowParameters }
    | { readonly type: 'field_present', readonly params: FieldPresentParameters }
    | { readonly type: 'improvement_lesson', readonly params: unknown }
    | { readonly type: 'callback_ok', readonly params: unknown }
    | { readonly type: 'not_parked', readonly params: unknown }

/**
The loop's state and transition surface in the state library's own config types,
so a state naming an event the loop does not accept, or an arm carrying a key the
library would reject, fails the typecheck. The action and guard payloads stay
ours (`ActionSpec`, `GuardSpec`): naming the setup maps' parameterised types here
would need `setup` at module scope, and the lazy import exists so a broken
install has one origin.
*/
type NativeLoopConfig = MachineConfig<
  LoopContext,
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
  LoopContext,
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
  readonly signals: Readonly<Partial<Record<ToolSignal, SignalSpec>>>
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
  readonly signal_keys?: readonly ToolSignal[]
}

export type EmitRequest = PromptEmit | ShellEmit | DispatchEmit | SkillEmit | MemoriesEmit | SignalsEmit

const PROMPT_FALLBACK = 'Sent synthetic message: '

/**
The line a person sees beside a synthetic prompt. A prompt action supplies it;
an emit without one is named by the opening words of its text.
*/
export const promptDescription = (emit: Pick<PromptEmit, 'text' | 'description'>): string =>
  emit.description ?? PROMPT_FALLBACK + emit.text.slice(0, 20) + '...'

export interface SessionMachine {
  readonly sessionId: string
  readonly agent: string
  readonly state: LoopStateId
  readonly context: LoopContext
}

export interface SignalRequest {
  readonly type: `agent_sent_signal.${ToolSignal}`
  readonly payload?: unknown
}

export type CallbackEventType = `callback.${CallbackName}`

/**
Why the host stopped a turn. A provider failure is not an interruption: it keeps
the panic path, while a person taking control parks the loop.
*/
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
    | { readonly type: CallbackEventType, readonly payload: CallbackPayload }

/**
One started machine, as the state library exposes it. Emits are collected during
`send` and `start`, then drained by the caller, so the actor never performs I/O.
*/
export interface Actor {
  send: (event: LoopEvent) => void
  state: () => LoopStateId
  context: () => LoopContext
  takeEmits: () => readonly EmitRequest[]
}

export interface StateMachineLibrary {
  createActor: (loop: LoopDefinition, startState: LoopStateId, context: LoopContext) => Actor
}

const goalRequestText = (): string =>
  'This session runs a state machine. What goal should it accomplish?'

const followUpText = (state: LoopStateId): string =>
  'This session is still in ' + state + '. Call signal_send to move on.'

const parkText = (count: number): string =>
  'This session went idle ' + count + ' times without progress, so it is parked in panic for debugging.'
  + ' Available from here: none.'

const qualityCheckFailedText = (context: LoopContext): string =>
  'Quality check failed: ' + (context.failure?.reason ?? 'unknown')
  + (context.failure?.detail === undefined ? '' : ' (' + context.failure.detail + ')')
  + '. Parked in panic for investigation.'

const validationSelfReportText = (): string =>
  'Verdict: call signal_send with type GOAL_ACHIEVED when the goal is met,'
  + ' or GOAL_INCOMPLETE when it is not.'

const memorizeText = (context: LoopContext): string => context.intent === 'improvement'
  ? 'Name one improvement.'
  : 'Name what to change next attempt.'

const panicEscalationText = (context: LoopContext): string =>
  'Parked for investigation: ' + (context.failure?.reason ?? 'unknown')
  + (context.failure?.detail === undefined ? '' : ' (' + context.failure.detail + ')')

const sentence = (text: string): string => /[.!?]$/.test(text) ? text : text + '.'

const parkSummaryText = (context: LoopContext): string =>
  'Goal reached: ' + sentence(context.goal)
  + ' Improvements: ' + sentence(context.improvements.join(' | ') || 'none')
  + ' Waiting for your next instruction.'

const workTowardsGoalText = (context: LoopContext): string =>
  'Work towards: ' + context.goal
  + '. Memories: ' + (context.memories.join(' | ') || 'none')
  + '. Preferences: ' + (context.injected['preferences/user']?.full.join(' | ') || 'none')

const renderTemplate = (parameters: PromptTemplate, context: LoopContext): string => {
  switch (parameters.template) {
    case 'goal_request': {
      return goalRequestText()
    }
    case 'state_follow_up': {
      return followUpText(parameters.state)
    }
    case 'idle_park': {
      return parkText(context.idleCount)
    }
    case 'quality_check_failed': {
      return qualityCheckFailedText(context)
    }
    case 'validation_self_report': {
      return validationSelfReportText()
    }
    case 'memorize': {
      return memorizeText(context)
    }
    case 'panic_escalation': {
      return panicEscalationText(context)
    }
    case 'park_summary': {
      return parkSummaryText(context)
    }
    case 'work_towards_goal': {
      return workTowardsGoalText(context)
    }
  }
}

/**
The idle arm: count this idle and nudge, until the allowance is used up; then
park in panic with the count that got us here and reset it for any later round.
*/
const idleArms = (state: LoopStateId): readonly LoopArm[] => [
  {
    guard: { type: 'counter_below', params: { key: 'idleCount', limit: MAX_IDLE_FOLLOW_UPS } },
    actions: [
      { type: 'record', params: { op: 'increment', key: 'idleCount' } },
      { type: 'prompt', params: { template: 'state_follow_up', state, description: 'Remind the agent that the loop is still waiting to move on.' } },
      { type: 'display_signals', params: {} },
    ],
  },
  {
    target: 'panic',
    actions: [
      { type: 'prompt', params: { template: 'idle_park', description: 'Report that repeated idle turns parked the session for debugging.' } },
      { type: 'record', params: { op: 'set', key: 'idleCount', source: { from: 'literal', value: 0 } } },
    ],
  },
]

const resetRound: readonly ActionSpec[] = [
  { type: 'record', params: { op: 'set', key: 'goal', source: { from: 'literal', value: '' } } },
  { type: 'record', params: { op: 'set', key: 'intent', source: { from: 'literal', value: 'none' } } },
  { type: 'record', params: { op: 'set', key: 'attempts', source: { from: 'literal', value: 0 } } },
  { type: 'record', params: { op: 'set', key: 'idleCount', source: { from: 'literal', value: 0 } } },
]

export const SESSION_LOOP: LoopDefinition = {
  id: 'session',
  /**
  An interruption parks the loop from every state. `parked` is excluded because
  entering it again would repeat the park summary for an event that changed nothing.
  */
  on: {
    system_interrupted: { target: '.parked', guard: { type: 'not_parked' } },
  },
  states: {
    define_goal: {
      entry: [
        { type: 'prompt', params: { template: 'goal_request', description: 'Ask the agent what goal this session should accomplish.' } },
        { type: 'display_signals', params: {} },
        { type: 'request_memories', params: { namespace: 'preferences/user' } },
        {
          type: 'set_tools_policy',
          params: {
            stateId: 'define_goal',
            allowedTools: ['signal_send', 'execute', 'question', 'skill'],
            errorMessage: 'Tool <name> is blocked in <state>. Call signal_send with SET_GOAL and a goal to continue.',
          },
        },
      ],
      exit: [{ type: 'clear_tools_policy', params: {} }],
      signals: {
        SET_GOAL: {
          describe: 'State the goal this session must accomplish, in payload.goal.',
          schema: Schema.Struct({ goal: Schema.Trim.check(Schema.isMinLength(1)) }).annotate({ examples: [{ goal: 'ship the parser' }] }),
        },
      },
      on: {
        [signalEvent('SET_GOAL')]: {
          target: 'work',
          actions: [{ type: 'record', params: { op: 'set', key: 'goal', source: { from: 'payload', field: 'goal' } } }],
        },
        [callbackEvent('memories_ready')]: {
          actions: [{ type: 'record_callback', params: { reportTo: 'memories_ready', key: 'preferences/user' } }],
        },
      },
    },
    work: {
      entry: [
        { type: 'prompt', params: { template: 'work_towards_goal', description: 'Remind the agent of the goal and the memories to work from.' } },
        { type: 'display_signals', params: {} },
        { type: 'request_skill', params: { name: 'task-delegation' } },
      ],
      signals: {
        CLAIM_WORK: { describe: 'Say the work is done and ready for the quality check.' },
      },
      on: {
        [signalEvent('CLAIM_WORK')]: { target: 'check' },
        [callbackEvent('skill_ready')]: {
          actions: [
            { type: 'record_callback', params: { reportTo: 'skill_ready' } },
            { type: 'mark_skill', params: { name: 'task-delegation' } },
          ],
        },
        [callbackEvent('memories_ready')]: {
          actions: [{ type: 'record_callback', params: { reportTo: 'memories_ready', key: 'preferences/user' } }],
        },
        system_idle: idleArms('work'),
      },
    },
    check: {
      entry: [{
        type: 'request_shell',
        params: { cmd: 'just opencode::typecheck', reportTo: 'quality_check_ready' },
      }],
      signals: {},
      on: {
        [callbackEvent('quality_check_ready')]: [
          {
            guard: { type: 'callback_ok' },
            target: 'validate',
            actions: [{ type: 'record_callback', params: { reportTo: 'quality_check_ready' } }],
          },
          {
            target: 'panic',
            actions: [
              { type: 'record_callback', params: { reportTo: 'quality_check_ready' } },
              { type: 'prompt', params: { template: 'quality_check_failed', description: 'Report that the quality check failed and the loop is parked.' } },
            ],
          },
        ],
      },
    },
    validate: {
      entry: [{ type: 'prompt', params: { template: 'validation_self_report', description: 'Ask the agent to judge whether the goal is met.' } }],
      signals: {
        GOAL_ACHIEVED: { describe: 'Report that the goal is met.' },
        GOAL_INCOMPLETE: { describe: 'Report that the goal is not met.' },
      },
      on: {
        [signalEvent('GOAL_ACHIEVED')]: {
          target: 'memorize',
          actions: [{ type: 'record', params: { op: 'set', key: 'intent', source: { from: 'literal', value: 'improvement' } } }],
        },
        [signalEvent('GOAL_INCOMPLETE')]: [
          {
            guard: {
              type: 'counter_below',
              params: { key: 'attempts', limit: { fromContext: 'maxAttempts' } },
            },
            target: 'memorize',
            actions: [
              { type: 'record', params: { op: 'increment', key: 'attempts' } },
              { type: 'record', params: { op: 'set', key: 'intent', source: { from: 'literal', value: 'lesson' } } },
            ],
          },
          {
            target: 'panic',
            actions: [
              { type: 'fail', params: { reason: 'attempts exhausted' } },
              { type: 'record', params: { op: 'set', key: 'intent', source: { from: 'literal', value: 'lesson' } } },
              { type: 'prompt', params: { template: 'panic_escalation', description: 'Report that the attempts ran out and the loop is parked.' } },
            ],
          },
        ],
        system_idle: idleArms('validate'),
      },
    },
    memorize: {
      entry: [
        { type: 'prompt', params: { template: 'memorize', description: 'Request a lesson to carry into the next attempt.' } },
        { type: 'display_signals', params: {} },
      ],
      signals: {
        LESSON: {
          describe: 'Name the improvement or next attempt in payload.text.',
          schema: Schema.Struct({ text: Schema.Trim.check(Schema.isMinLength(1)) }).annotate({ examples: [{ text: 'run typecheck before claiming done' }] }),
        },
      },
      on: {
        [signalEvent('LESSON')]: [
          {
            guard: { type: 'improvement_lesson' },
            target: 'parked',
            actions: [{
              type: 'record',
              params: { op: 'push', key: 'improvements', source: { from: 'payload', field: 'text' } },
            }],
          },
          {
            guard: { type: 'field_present', params: { field: 'text' } },
            target: 'work',
            actions: [{
              type: 'record',
              params: { op: 'push', key: 'memories', source: { from: 'payload', field: 'text' } },
            }],
          },
        ],
        system_idle: idleArms('memorize'),
      },
    },
    parked: {
      entry: [{ type: 'prompt', params: { template: 'park_summary', description: 'Report the reached goal and the improvements recorded.' } }],
      signals: {},
      on: {
        system_user_input: { target: 'define_goal', actions: resetRound },
      },
    },
    panic: {
      entry: [{ type: 'display_signals', params: {} }],
      signals: {
        LESSON: {
          describe: 'Name what to change next attempt in payload.text.',
          schema: Schema.Struct({ text: Schema.Trim.check(Schema.isMinLength(1)) }).annotate({ examples: [{ text: 'run typecheck before claiming done' }] }),
        },
      },
      on: {
        [signalEvent('LESSON')]: [
          {
            guard: { type: 'field_present', params: { field: 'text' } },
            target: 'work',
            actions: [
              {
                type: 'record',
                params: { op: 'push', key: 'memories', source: { from: 'payload', field: 'text' } },
              },
              { type: 'record', params: { op: 'set', key: 'attempts', source: { from: 'literal', value: 0 } } },
            ],
          },
        ],
        system_user_input: { target: 'define_goal', actions: resetRound },
      },
    },
  },
}

export const acceptedTransitions = (state: LoopStateId): ToolSignal[] =>
  TOOL_SIGNALS.filter(signal => SESSION_LOOP.states[state].on[signalEvent(signal)] !== undefined)

/**
 * The agent-to-starting-state mapping, read once. An entry naming a state the
 * loop does not declare is left out rather than defaulted, so its agent gets no
 * machine at all.
 */
export const readStartConfig = (startStates: Readonly<Record<string, string>>): {
  readonly startStateFor: (agent: string) => LoopStateId | undefined
  readonly invalidAgents: readonly string[]
} => {
  const mapped = new Map<string, LoopStateId>()
  const invalidAgents: string[] = []

  for (const [agent, state] of Object.entries(startStates)) {
    const declared = LOOP_STATE_IDS.find(candidate => candidate === state)

    if (declared === undefined) invalidAgents.push(agent)
    else mapped.set(agent, declared)
  }

  return { startStateFor: agent => mapped.get(agent), invalidAgents }
}

const readPayloadField = (event: LoopEvent, field: string): string => {
  const payload = (event as { payload?: unknown }).payload
  const value = isObject(payload) ? payload[field] : undefined
  return typeof value === 'string' ? value : ''
}

const INTENT_KINDS: readonly IntentKind[] = ['none', 'improvement', 'lesson']

const isIntentKind = (value: unknown): value is IntentKind =>
  typeof value === 'string' && (INTENT_KINDS as readonly string[]).includes(value)

const readSource = (event: LoopEvent, source: RecordSource): string | number =>
  source.from === 'literal' ? source.value : readPayloadField(event, source.field)

const applyRecord = (context: LoopContext, event: LoopEvent, parameters: RecordParameters): Partial<LoopContext> => {
  if (parameters.op === 'increment') {
    return parameters.key === 'attempts'
      ? { attempts: context.attempts + 1 }
      : { idleCount: context.idleCount + 1 }
  }

  const value = readSource(event, parameters.source)

  if (parameters.op === 'push') {
    if (typeof value !== 'string') return {}

    const list = parameters.key === 'memories' ? context.memories : context.improvements
    const next = context.memoryLimit > 0 ? [...list, value].slice(-context.memoryLimit) : []

    return parameters.key === 'memories' ? { memories: next } : { improvements: next }
  }

  if (parameters.key === 'intent') return { intent: isIntentKind(value) ? value : context.intent }
  if (parameters.key === 'attempts') return { attempts: typeof value === 'number' ? value : context.attempts }
  return parameters.key === 'idleCount' ? { idleCount: typeof value === 'number' ? value : context.idleCount } : { goal: typeof value === 'string' ? value : context.goal }
}

const applyFail = (parameters: FailParameters): Partial<LoopContext> => ({
  failure: { reason: parameters.reason, detail: parameters.detail },
})

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const isInjectedMemories = (value: unknown): value is InjectedMemories =>
  isObject(value) && isStringArray(value.full) && isStringArray(value.index)

const readCallback = (event: LoopEvent): CallbackPayload => {
  const payload = (event as { payload?: unknown }).payload

  return isObject(payload)
    ? {
        ok: payload.ok === true,
        exitCode: typeof payload.exitCode === 'number' ? payload.exitCode : undefined,
        output: typeof payload.output === 'string' ? payload.output : undefined,
        value: isInjectedMemories(payload.value) ? payload.value : undefined,
      }
    : { ok: false }
}

const applyRecordCallback = (
  context: LoopContext,
  event: LoopEvent,
  parameters: RecordCallbackParameters,
): Partial<LoopContext> => {
  const payload = readCallback(event)
  const results = { ...context.results, [parameters.reportTo]: payload }

  if (!payload.ok) {
    return { results, failure: { reason: parameters.reportTo + ' failed', detail: payload.output } }
  }

  return payload.value !== undefined && parameters.key !== undefined ? { results, injected: { ...context.injected, [parameters.key]: payload.value } } : { results }
}

interface LoopTransitionTable {
  readonly entry?: readonly ActionSpec[]
  readonly exit?: readonly ActionSpec[]
  readonly on: LoopOn
}

/**
The state config handed to XState: declaration data is stripped here.
*/
type NativeState = Omit<LoopState, 'signals'>

const isArmList = (arm: LoopArm | readonly LoopArm[]): arm is readonly LoopArm[] => Array.isArray(arm)

const toSingleArm = (arm: LoopArm): LoopArm => ({
  ...(arm.target !== undefined && { target: arm.target }),
  ...(arm.guard !== undefined && { guard: arm.guard }),
  ...(arm.actions !== undefined && { actions: [...(arm.actions as readonly ActionSpec[])] }),
})

const toArm = (arm: LoopArm | readonly LoopArm[]): LoopArm | readonly LoopArm[] =>
  isArmList(arm) ? arm.map(candidate => toSingleArm(candidate)) : toSingleArm(arm)

const toStateConfig = (definition: LoopTransitionTable): NativeState => ({
  ...(definition.entry !== undefined && { entry: [...definition.entry] }),
  ...(definition.exit !== undefined && { exit: [...definition.exit] }),
  on: Object.fromEntries(Object.entries(definition.on).map(([type, arm]) => [type, toArm(arm)])),
})

/**
 * The state table for one definition, rebuilt for the definition the caller hands
 * `createActor`, so a definition with its own states is honoured.
 */
const statesFor = (definition: LoopDefinition): Readonly<Record<string, NativeState>> =>
  Object.fromEntries(
    LOOP_STATE_IDS.map(state => [state, toStateConfig(definition.states[state])]),
  )

/**
 * The one place the state library is named. The entry calls it under guard; the
 * rest of the module receives the result, so a broken install has one origin.
 */
export const loadStateMachineLibrary = async (): Promise<StateMachineLibrary> => {
  const { assign, createActor, emit, enqueueActions, not, setup, stateIn } = await import('xstate')

  const machine = setup({
    types: {
      context: {} as LoopContext,
      events: {} as LoopEvent,
      emitted: {} as EmitRequest,
    },
    actions: {
      prompt: emit(({ context }, parameters: PromptParameters) => ({
        type: 'emit.prompt' as const,
        text: renderTemplate(parameters, context),
        description: parameters.description,
      })),
      record: assign(({ context, event }, parameters: RecordParameters) => applyRecord(context, event, parameters)),
      request_shell: emit((_arguments, parameters: ShellParameters) => ({
        type: 'emit.shell' as const,
        cmd: parameters.cmd,
        reportTo: parameters.reportTo,
      })),
      request_dispatch: emit(({ context }, parameters: DispatchParameters) => ({
        type: 'emit.dispatch' as const,
        agent: parameters.agent,
        text: renderTemplate({ template: 'validation_self_report' }, context),
      })),
      request_skill: enqueueActions(({ context, enqueue }, parameters: SkillParameters) => {
        if (context.injectedSkills.includes(skillKey(parameters.name))) return

        enqueue.emit({ type: 'emit.skill', name: parameters.name, reportTo: 'skill_ready' })
      }),
      request_memories: emit((_arguments, parameters: MemoriesParameters) => ({
        type: 'emit.memories' as const,
        namespace: parameters.namespace,
        reportTo: 'memories_ready' as const,
      })),
      display_signals: emit((_arguments, parameters: DisplaySignalsParameters) => ({
        type: 'emit.signals' as const,
        ...(parameters.signal_keys !== undefined && { signal_keys: parameters.signal_keys }),
      })),
      mark_skill: assign(({ context }, parameters: MarkSkillParameters) => ({
        injectedSkills: context.injectedSkills.includes(skillKey(parameters.name))
          ? context.injectedSkills
          : [...context.injectedSkills, skillKey(parameters.name)],
      })),
      record_callback: assign(({ context, event }, parameters: RecordCallbackParameters) =>
        applyRecordCallback(context, event, parameters)),
      fail: assign((_arguments, parameters: FailParameters) => applyFail(parameters)),
      set_tools_policy: assign(({ context }, parameters: ToolsPolicyParameters) =>
        // A restored session's snapshot rule wins; this fills a record that predates it.
        context.policy === undefined
          ? {
              policy: {
                stateId: parameters.stateId,
                errorMessage: parameters.errorMessage,
                allowedTools: [...parameters.allowedTools],
              },
            }
          : {}),
      clear_tools_policy: assign(() => ({ policy: undefined })),
    },
    guards: {
      counter_below: ({ context }, parameters: CounterBelowParameters) => {
        const limit = typeof parameters.limit === 'number'
          ? parameters.limit
          : context[parameters.limit.fromContext]

        return context[parameters.key] < limit
      },
      field_present: ({ event }, parameters: FieldPresentParameters) =>
        readPayloadField(event, parameters.field).trim() !== '',
      /**
      The LESSON schema has already refused blank text, so only the intent decides
      whether this lesson improves the loop or starts another attempt.
      */
      improvement_lesson: ({ context }) => context.intent === 'improvement',
      callback_ok: ({ event }) => readCallback(event).ok,
      not_parked: not(stateIn('parked')),
    },
  })

  return {
    createActor: (loop, startState, context) => {
      const actor = createActor(machine.createMachine({
        id: loop.id,
        initial: startState,
        context,
        on: { ...loop.on },
        states: statesFor(loop),
      }))
      const emitted: EmitRequest[] = []

      actor.on('*', (event) => {
        emitted.push(event)
      })
      actor.start()

      return {
        send: event => actor.send(event),
        state: () => actor.getSnapshot().value as unknown as LoopStateId,
        context: () => actor.getSnapshot().context,
        takeEmits: () => emitted.splice(0),
      }
    },
  }
}

const NO_MACHINE_MESSAGE = 'No state machine is running for this session.'

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

interface StateMachineOptions {
  readonly library: StateMachineLibrary
  readonly startStateFor: (agent: string) => LoopStateId | undefined
  readonly maxAttempts?: number
  readonly memoryLimit?: number
  readonly snapshot?: SnapshotStore
}

export interface SessionStart {
  readonly machine: SessionMachine
  readonly created: boolean
  readonly emits: readonly EmitRequest[]
  /**
  How the machine came to exist: restored from a snapshot, fresh at the agent's
  start state, or a read that was rejected and left the session without one.
  */
  readonly snapshot?: 'restored' | 'fresh' | 'read-failed' | 'expired' | 'shape-invalid'
}

export interface SignalResult {
  readonly text: string
  readonly emits: readonly EmitRequest[]
  readonly refusal?: SignalRefusal
}

/**
Runs one emitted shell command outside the actor and reports the outcome.
*/
export type RunShell = (command: string, cwd: string) => Effect.Effect<CallbackPayload>

/**
Injects one skill into the session and reports completion.
*/
export type InjectSkill = (sessionId: string, name: string) => Effect.Effect<void, unknown>

/**
Reads the remembered preferences for one namespace.
*/
export type LoadMemories = (namespace: string) => Effect.Effect<InjectedMemories, unknown>

export interface StateMachine {
  /**
  Creates the session's machine when its agent is mapped; never on a signal.
  */
  start: (sessionId: string, agent: string) => SessionStart | undefined
  /**
  Restores the session from its snapshot on first access, or starts it fresh.
  Concurrent first accesses share one read. Undefined means the read was
  rejected, so the session has no machine and the gate allows.
  */
  ensure: (sessionId: string, agent: string) => Effect.Effect<SessionStart | undefined>
  /**
  Writes the whole snapshot after a change. `skipped` means no machine or no
  store; `write-failed` means the store rejected it and the previous record stands.
  */
  persist: (sessionId: string) => Effect.Effect<'written' | 'skipped' | 'write-failed'>
  get: (sessionId: string) => SessionMachine | undefined
  /**
  The state and the active tool policy, read from memory.
  */
  state: (sessionId: string) => LoopStateId | undefined
  policy: (sessionId: string) => ToolPolicyRule | undefined
  /**
  The emits a fresh session held for its first user message; empty afterwards.
  */
  wake: (sessionId: string) => readonly EmitRequest[]
  /**
  Applies one signal. A refusal is a normal result, not a failure.
  */
  signal: (input: unknown, sessionId: string) => SignalResult
  /**
  Delivers a subscriber's answer as an ordinary event.
  */
  callback: (sessionId: string, name: CallbackName, payload: CallbackPayload) => readonly EmitRequest[]
  /**
  A user message restarts the round from `parked` or `panic`.
  */
  userInput: (sessionId: string, text: string) => readonly EmitRequest[]
  /**
  An interruption parks the loop: the person taking control, not a failure.
  */
  interrupted: (sessionId: string, reason: InterruptReason) => readonly EmitRequest[]
  /**
  The machine's current position, for a tool call without an agent context.
  */
  status: (sessionId: string) => string
  /**
  The rendered signal list for the session's current state.
  */
  signalLine: (sessionId: string, signal_keys?: readonly ToolSignal[]) => string
  idle: (sessionId: string) => Effect.Effect<readonly EmitRequest[]>
}

interface MachineEntry {
  readonly actor: Actor
  readonly sessionId: string
  readonly agent: string
  /**
  Entry emits held until a real user message arrives. A session starts silently:
  the goal request is a reply to the person, not a greeting into an empty chat.
  */
  pending: EmitRequest[]
}

export const createStateMachine = (options: StateMachineOptions): StateMachine => {
  assertSignalDeclarations(SESSION_LOOP)

  const machines = new Map<string, MachineEntry>()
  const waiting = new Map<string, Deferred.Deferred<SessionStart | undefined>>()

  /**
  The actor's own context: the tool policy lives there, installed by the entry
  action and cleared by the exit action, so a transition keeps it in step.
  */
  const liveContext = (entry: MachineEntry): LoopContext => entry.actor.context()

  const view = (entry: MachineEntry): SessionMachine => ({
    sessionId: entry.sessionId,
    agent: entry.agent,
    state: entry.actor.state(),
    context: liveContext(entry),
  })

  const freshContext = (sessionId: string, agent: string): LoopContext => ({
    sessionId,
    agent,
    maxAttempts: options.maxAttempts ?? MAX_ATTEMPTS,
    memoryLimit: options.memoryLimit ?? MEMORY_LIMIT,
    goal: '',
    intent: 'none',
    attempts: 0,
    idleCount: 0,
    memories: [],
    improvements: [],
    injectedSkills: [],
    injected: {},
    results: {},
  })

  const contextFromSnapshot = (snapshot: SessionSnapshot, agent: string): LoopContext => ({
    ...freshContext(snapshot.sessionId, agent),
    goal: snapshot.goal,
    intent: snapshot.intent,
    attempts: snapshot.attempts,
    idleCount: snapshot.idleCount,
    memories: [...snapshot.memories],
    improvements: [...snapshot.improvements],
    injectedSkills: [...snapshot.injectedSkills],
    injected: { ...snapshot.injected },
    results: { ...snapshot.results },
    ...(snapshot.policy !== undefined && { policy: snapshot.policy }),
    ...(snapshot.failure !== undefined && { failure: snapshot.failure }),
  })

  const create = (
    sessionId: string,
    agent: string,
    startState: LoopStateId,
    context: LoopContext,
    isRestored: boolean,
  ): SessionStart => {
    const entry: MachineEntry = {
      actor: options.library.createActor(SESSION_LOOP, startState, context),
      sessionId,
      agent,
      pending: [],
    }

    if (isRestored) {
      // Entry actions do run on a restored state: their `assign`s land again, which
      // is safe because they are idempotent (`set_tools_policy` keeps the restored
      // rule). Only their emits are dropped, because those were delivered before the
      // reload and takeEmits discards the replay.
      entry.actor.takeEmits()
    }
    else {
      entry.pending = [...entry.actor.takeEmits()]
    }

    machines.set(sessionId, entry)

    return {
      machine: view(entry),
      created: true,
      emits: [],
      snapshot: isRestored ? 'restored' : 'fresh',
    }
  }

  /**
  Hands back what the entry held for the first real user message.
  */
  const wake = (sessionId: string): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) return []

    const held = entry.pending
    entry.pending = []
    return held
  }

  const start = (sessionId: string, agent: string): SessionStart | undefined => {
    const existing = machines.get(sessionId)

    if (existing !== undefined) return { machine: view(existing), created: false, emits: [] }

    const startState = options.startStateFor(agent)

    return startState === undefined ? undefined : create(sessionId, agent, startState, freshContext(sessionId, agent), false)
  }

  const load = (sessionId: string, agent: string): Effect.Effect<SessionStart | undefined> => Effect.gen(function* () {
    const snapshot = options.snapshot

    if (snapshot === undefined) return start(sessionId, agent)

    const read = yield* snapshot.read(sessionId)

    if (read.status === 'rejected') return

    const startState = options.startStateFor(agent)

    if (startState === undefined) return

    if (read.status === 'absent') {
      const started = create(sessionId, agent, startState, freshContext(sessionId, agent), false)

      return read.reason === 'missing' ? started : { ...started, snapshot: read.reason }
    }

    const stored = read.record.payload

    return TRANSIENT_STATES.has(stored.state) ? { ...create(sessionId, agent, startState, freshContext(sessionId, agent), false), snapshot: 'shape-invalid' } : create(sessionId, agent, stored.state, contextFromSnapshot(stored, agent), true)
  })

  const ensure = (sessionId: string, agent: string): Effect.Effect<SessionStart | undefined> => Effect.suspend(() => {
    const existing = machines.get(sessionId)

    if (existing !== undefined) return Effect.succeed<SessionStart | undefined>({ machine: view(existing), created: false, emits: [] })

    const waitingOn = waiting.get(sessionId)

    if (waitingOn !== undefined) return Deferred.await(waitingOn)

    const deferred = Deferred.makeUnsafe<SessionStart | undefined>()

    waiting.set(sessionId, deferred)

    const settle = (value: SessionStart | undefined): Effect.Effect<SessionStart | undefined> =>
      Deferred.succeed(deferred, value).pipe(Effect.andThen(Effect.succeed(value)))

    return load(sessionId, agent).pipe(
      Effect.flatMap(value => settle(value)),
      Effect.catchCause(() => settle(undefined)),
      Effect.ensuring(Effect.sync(() => { waiting.delete(sessionId) })),
    )
  })

  const persist = (sessionId: string): Effect.Effect<'written' | 'skipped' | 'write-failed'> => Effect.suspend(() => {
    const entry = machines.get(sessionId)
    const snapshot = options.snapshot

    return entry === undefined || snapshot === undefined
      ? Effect.succeed('skipped' as const)
      : snapshot.write({
          ...liveContext(entry),
          state: entry.actor.state(),
          updatedAt: new Date().toISOString(),
        }).pipe(
          Effect.map(ok => ok ? 'written' as const : 'write-failed' as const),
          Effect.catchCause(() => Effect.succeed('write-failed' as const)),
        )
  })

  const signal = (input: unknown, sessionId: string): SignalResult => {
    const entry = machines.get(sessionId)

    if (entry === undefined) return { text: NO_MACHINE_MESSAGE, emits: [] }

    const state = entry.actor.state()
    const signals = SESSION_LOOP.states[state].signals
    const validation = validateSignal(input, state, signals)

    if (!validation.ok) {
      return {
        text: refusalMessage(validation.refusal, signals),
        emits: [],
        refusal: validation.refusal,
      }
    }

    entry.actor.send(validation.event)
    markAwake(entry)

    return {
      text: 'Signal accepted.',
      emits: entry.actor.takeEmits(),
    }
  }

  const status = (sessionId: string): string => {
    const entry = machines.get(sessionId)

    return entry === undefined ? NO_MACHINE_MESSAGE : 'State: ' + entry.actor.state() + '.'
  }

  const signalLine = (sessionId: string, signal_keys?: readonly ToolSignal[]): string => {
    const entry = machines.get(sessionId)

    return entry === undefined
      ? 'Signals now: none'
      : renderSignals(SESSION_LOOP.states[entry.actor.state()].signals, signal_keys)
  }

  const callback = (
    sessionId: string,
    name: CallbackName,
    payload: CallbackPayload,
  ): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) return []

    entry.actor.send({ type: callbackEvent(name), payload })
    markAwake(entry)
    return entry.actor.takeEmits()
  }

  const userInput = (sessionId: string, text: string): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) return []

    entry.actor.send({ type: 'system_user_input', text })
    markAwake(entry)
    return entry.actor.takeEmits()
  }

  const interrupted = (sessionId: string, reason: InterruptReason): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) return []

    entry.actor.send({ type: 'system_interrupted', reason })
    markAwake(entry)
    return entry.actor.takeEmits()
  }

  const idle = (sessionId: string): Effect.Effect<readonly EmitRequest[]> =>
    Effect.sync(() => {
      const entry = machines.get(sessionId)

      if (entry === undefined) return []

      entry.actor.send({ type: 'system_idle' })
      markAwake(entry)
      return entry.actor.takeEmits()
    })

  /**
  Any event means the loop is awake: a held goal request must not arrive late.
  */
  const markAwake = (entry: MachineEntry): void => {
    entry.pending = []
  }

  const stateOf = (sessionId: string): LoopStateId | undefined => machines.get(sessionId)?.actor.state()
  const policyOf = (sessionId: string): ToolPolicyRule | undefined =>
    machines.get(sessionId)?.actor.context().policy

  return {
    start, ensure, persist, state: stateOf, policy: policyOf, signalLine, wake, get: (sessionId) => {
      const entry = machines.get(sessionId)
      return entry === undefined ? undefined : view(entry)
    }, signal, callback, userInput, interrupted, status, idle,
  }
}
