/**
 * The loop's behaviour: the action bodies and guard bodies the JSON workflow
 * names by type, plus the prompt templates they render. The table in
 * `machine.json` supplies the parameters; this module supplies the code.
 */
import { Schema } from 'effect'

import type {
  CallbackName,
  CallbackPayload,
  InjectedMemories,
  IntentKind,
  LoopContext,
  LoopEvent,
  LoopStateId,
  PromptEmit,
} from '../../core/machine'
import { skillKey } from '../../core/memory'
import type { SignalSpec, ToolSignal } from '../../core/signals'

export type TemplateId
  = | 'goal_request'
    | 'quality_check_failed'
    | 'validation_self_report'
    | 'memorize'
    | 'panic_escalation'
    | 'park_summary'
    | 'work_towards_goal'

export type PromptTemplate
  = | { readonly template: 'goal_request' }
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
  = | { readonly op: 'set', readonly key: 'goal' | 'attempts' | 'intent', readonly source: RecordSource }
    | { readonly op: 'increment', readonly key: 'attempts' }
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
  readonly notify_agent: boolean
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
    | { readonly type: 'update_signals_policy', readonly params: UpdateSignalsPolicyParameters }
    | { readonly type: 'record_callback', readonly params: RecordCallbackParameters }
    | { readonly type: 'mark_skill', readonly params: MarkSkillParameters }
    | { readonly type: 'set_tools_policy', readonly params: ToolsPolicyParameters }
    | { readonly type: 'clear_tools_policy', readonly params: Record<string, never> }
    | { readonly type: 'admit_identity', readonly params: Record<string, never> }
    | { readonly type: 'fail', readonly params: FailParameters }

export interface CounterBelowParameters {
  readonly key: 'attempts'
  readonly limit: number | { readonly fromContext: 'maxAttempts' }
}

export interface FieldPresentParameters {
  readonly field: 'goal' | 'text'
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
  'request_shell',
  'request_dispatch',
  'request_skill',
  'request_memories',
  'update_signals_policy',
  'record_callback',
  'mark_skill',
  'set_tools_policy',
  'clear_tools_policy',
  'admit_identity',
  'fail',
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

const PROMPT_FALLBACK = 'Sent synthetic message: '

/**
The line a person sees beside a synthetic prompt. A prompt action supplies it;
an emit without one is named by the opening words of its text.
*/
export const promptDescription = (emit: Pick<PromptEmit, 'text' | 'description'>): string =>
  emit.description ?? PROMPT_FALLBACK + emit.text.slice(0, 20) + '...'

const goalRequestText = (): string =>
  'This session runs a state machine. What goal should it accomplish?'

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

export const renderTemplate = (parameters: PromptTemplate, context: LoopContext): string => {
  switch (parameters.template) {
    case 'goal_request': {
      return goalRequestText()
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

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

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
    return { attempts: context.attempts + 1 }
  }

  const value = readSource(event, parameters.source)

  if (parameters.op === 'push') {
    if (typeof value !== 'string') return {}

    const list = parameters.key === 'memories' ? context.memories : context.improvements
    const next = context.memoryLimit > 0 ? [...list, value].slice(-context.memoryLimit) : []

    return parameters.key === 'memories' ? { memories: next } : { improvements: next }
  }

  if (parameters.key === 'intent') return { intent: isIntentKind(value) ? value : context.intent }
  return parameters.key === 'attempts' ? { attempts: typeof value === 'number' ? value : context.attempts } : { goal: typeof value === 'string' ? value : context.goal }
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

/**
The two payload codecs a signal declares. A codec cannot live in JSON, so the
manifest's schemas are documentation and this table is what validates.
*/
export const SIGNAL_SCHEMAS: Readonly<Partial<Record<ToolSignal, Schema.Codec<unknown, unknown, never, never>>>> = {
  SET_GOAL: Schema.Struct({ goal: Schema.Trim.check(Schema.isMinLength(1)) }).annotate({ examples: [{ goal: 'ship the parser' }] }),
  LESSON: Schema.Struct({ text: Schema.Trim.check(Schema.isMinLength(1)) }).annotate({ examples: [{ text: 'run typecheck before claiming done' }] }),
}

export interface ManifestSignal {
  readonly describe: string
}

/**
One machine's signal declarations: the manifest's prose plus the payload codecs
JSON cannot hold. The definition supplies the ad-hoc names its policies add.
*/
export interface SignalSources {
  readonly signals: Readonly<Record<string, ManifestSignal>>
  readonly codecs: Readonly<Partial<Record<string, SignalSpec['schema']>>>
}

const codecOf = (name: string, sources: SignalSources): SignalSpec['schema'] => sources.codecs[name]

const manifestSpec = (name: string, sources: SignalSources): SignalSpec => {
  const declared = sources.signals[name]

  if (declared === undefined) {
    throw new Error('update_signals_policy names ' + name + ', which signals.manifest.json does not declare')
  }

  const schema = codecOf(name, sources)

  return schema === undefined ? { describe: declared.describe } : { describe: declared.describe, schema }
}

const aliasSpec = (name: string, alias: AdHocSignal, sources: SignalSources): SignalSpec => {
  if (alias.description.trim() === '') {
    throw new Error('update_signals_policy gives ' + name + ' a blank description')
  }

  if (alias.schema === undefined) return { describe: alias.description }

  if (sources.signals[alias.schema] === undefined) {
    throw new Error('update_signals_policy gives ' + name + ' schema ' + alias.schema + ', which signals.manifest.json does not declare')
  }

  const schema = codecOf(alias.schema, sources)

  return schema === undefined ? { describe: alias.description } : { describe: alias.description, schema }
}

/**
The signals one policy enables, in the order it names them, with the prose and
codec the machine validates against. A name the manifest does not declare throws
when the machine is assembled, rather than enabling a signal nothing answers.
*/
export const updateSignalsPolicySpecs = (
  parameters: UpdateSignalsPolicyParameters,
  sources: SignalSources,
): Readonly<Record<string, SignalSpec>> => {
  const specs: Record<string, SignalSpec> = {}

  for (const entry of parameters.set_enabled_signals) {
    if (typeof entry === 'string') {
      specs[entry] = manifestSpec(entry, sources)
      continue
    }

    const aliases = Object.entries(entry)

    if (aliases.length === 0) {
      throw new Error('update_signals_policy enables an object that names no signal')
    }

    for (const [name, alias] of aliases) specs[name] = aliasSpec(name, alias, sources)
  }

  return specs
}

const policyParameters = (actions: unknown): readonly UpdateSignalsPolicyParameters[] => {
  const list = actions === undefined ? [] : (Array.isArray(actions) ? actions : [actions])

  return list.flatMap((action) => {
    if (!isObject(action) || action.type !== 'update_signals_policy') return []

    const parameters = action.params

    return isObject(parameters) && Array.isArray(parameters.set_enabled_signals)
      ? [parameters as unknown as UpdateSignalsPolicyParameters]
      : []
  })
}

export const declaredPolicyParameters = (definition: unknown): readonly UpdateSignalsPolicyParameters[] => {
  if (!isObject(definition) || !isObject(definition.states)) return []

  const parameters: UpdateSignalsPolicyParameters[] = []

  for (const state of Object.values(definition.states)) {
    if (!isObject(state)) continue

    parameters.push(...policyParameters(state.entry), ...policyParameters(state.exit))

    if (!isObject(state.on)) continue

    for (const arm of Object.values(state.on)) {
      for (const single of Array.isArray(arm) ? arm : [arm]) {
        parameters.push(...policyParameters(isObject(single) ? single.actions : undefined))
      }
    }
  }

  return parameters
}

/**
Every signal one machine's policies may name, resolved once when it is
assembled: the manifest's own signals, then every ad-hoc entry the definition's
`update_signals_policy` items declare. An unknown name, a blank description or a
schema reference the manifest lacks throws here rather than at the first arrival.
*/
export const createSignalRegistry = (
  definition: unknown,
  sources: SignalSources,
): Readonly<Record<string, SignalSpec>> => {
  const registry: Record<string, SignalSpec> = {}

  for (const name of Object.keys(sources.signals)) registry[name] = manifestSpec(name, sources)

  for (const parameters of declaredPolicyParameters(definition)) {
    for (const [name, spec] of Object.entries(updateSignalsPolicySpecs(parameters, sources))) registry[name] = spec
  }

  return registry
}

/**
The spec for one signal name, read from the running machine's registry. Throws
rather than let an undeclared name reach validation or the agent.
*/
export const signalSpec = (name: string, registry: Readonly<Record<string, SignalSpec>>): SignalSpec => {
  const spec = registry[name]

  if (spec === undefined) {
    throw new Error('update_signals_policy names ' + name + ', which neither signals.manifest.json nor machine.json declares')
  }

  return spec
}

/**
The library surface this module needs. `machine.ts` keeps the single lazy
`import('xstate')` and hands the functions over, so a broken install has one origin.
*/
export type XStateRuntime = Pick<typeof import('xstate'), 'assign' | 'emit' | 'enqueueActions' | 'not' | 'stateIn'>

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
The part of the collect-actions argument `request_skill` reads. Outside `setup`
nothing supplies the context type, so it is named here.
*/
interface SkillArguments {
  readonly context: LoopContext
  readonly enqueue: {
    emit(event: { readonly type: string, readonly name: string, readonly reportTo: CallbackName }): void
  }
}

export const createActions = (runtime: XStateRuntime, sources: SignalSources) => ({
  prompt: runtime.emit(({ context }: { context: LoopContext }, parameters: PromptParameters) => ({
    type: 'emit.prompt' as const,
    text: renderTemplate(parameters, context),
    description: parameters.description,
  })),
  record: runtime.assign(({ context, event }: { context: LoopContext, event: LoopEvent }, parameters: RecordParameters) =>
    applyRecord(context, event, parameters)),
  request_shell: runtime.emit((_arguments, parameters: ShellParameters) => ({
    type: 'emit.shell' as const,
    cmd: parameters.cmd,
    reportTo: parameters.reportTo,
  })),
  request_dispatch: runtime.emit(({ context }: { context: LoopContext }, parameters: DispatchParameters) => ({
    type: 'emit.dispatch' as const,
    agent: parameters.agent,
    text: renderTemplate({ template: 'validation_self_report' }, context),
  })),
  request_skill: runtime.enqueueActions(({ context, enqueue }: SkillArguments, parameters: SkillParameters) => {
    if (context.injectedSkills.includes(skillKey(parameters.name))) return

    enqueue.emit({ type: 'emit.skill', name: parameters.name, reportTo: 'skill_ready' })
  }),
  request_memories: runtime.emit((_arguments, parameters: MemoriesParameters) => ({
    type: 'emit.memories' as const,
    namespace: parameters.namespace,
    reportTo: 'memories_ready' as const,
  })),
  update_signals_policy: runtime.enqueueActions(({ enqueue }: SignalsPolicyArguments, parameters: UpdateSignalsPolicyParameters) => {
    const names = Object.keys(updateSignalsPolicySpecs(parameters, sources))

    if (parameters.notify_agent) enqueue.emit({ type: 'emit.signals' as const, signal_keys: names })

    enqueue.assign({ signalsPolicy: { names } })
  }),
  mark_skill: runtime.assign(({ context }: { context: LoopContext }, parameters: MarkSkillParameters) => ({
    injectedSkills: context.injectedSkills.includes(skillKey(parameters.name))
      ? context.injectedSkills
      : [...context.injectedSkills, skillKey(parameters.name)],
  })),
  record_callback: runtime.assign(({ context, event }: { context: LoopContext, event: LoopEvent }, parameters: RecordCallbackParameters) =>
    applyRecordCallback(context, event, parameters)),
  fail: runtime.assign((_arguments, parameters: FailParameters) => applyFail(parameters)),
  set_tools_policy: runtime.assign(({ context }: { context: LoopContext }, parameters: ToolsPolicyParameters) =>
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
  clear_tools_policy: runtime.assign(() => ({ policy: undefined })),
  admit_identity: runtime.assign(({ event }: { event: LoopEvent }) =>
    event.type === 'admit' ? { agent: event.agent, parentID: event.parentID } : {}),
}) satisfies Record<ActionType, unknown>

type AdmissionIdentity = { readonly agent: string, readonly parentID?: string | undefined }

/**
The `admit` event carries the identity a session created before its agent was
known does not hold yet; any other event reads the context's copy.
*/
const identityOf = (context: LoopContext, event: LoopEvent): AdmissionIdentity =>
  event.type === 'admit'
    ? { agent: event.agent, parentID: event.parentID }
    : { agent: context.agent, parentID: context.parentID }

export const createGuards = (runtime: XStateRuntime) => ({
  counter_below: ({ context }: { context: LoopContext }, parameters: CounterBelowParameters) => {
    const limit = typeof parameters.limit === 'number'
      ? parameters.limit
      : context[parameters.limit.fromContext]

    return context[parameters.key] < limit
  },
  field_present: ({ event }: { event: LoopEvent }, parameters: FieldPresentParameters) =>
    readPayloadField(event, parameters.field).trim() !== '',
  /**
  The LESSON schema has already refused blank text, so only the intent decides
  whether this lesson improves the loop or starts another attempt.
  */
  improvement_lesson: ({ context }: { context: LoopContext }) => context.intent === 'improvement',
  callback_ok: ({ event }: { event: LoopEvent }) => readCallback(event).ok,
  not_parked: runtime.not(runtime.stateIn('parked')),
  /**
  A session a subagent created never loops, whatever agent id it runs, so the
  parent check joins the allowlist rather than replacing it.
  */
  session_agent: ({ context, event }: { context: LoopContext, event: LoopEvent }, parameters: SessionAgentParameters) => {
    const { agent, parentID } = identityOf(context, event)

    return agent !== ''
      && parameters.in.includes(agent)
      && (parentID === undefined || parentID === '')
  },
}) satisfies Record<GuardType, unknown>
