/**
 * The loop's behaviour: the action bodies and guard bodies the JSON workflow
 * names by type, plus the values its prompt templates fill. The table in
 * `machine.json` supplies the parameters; this module supplies the code, and
 * `templates/` supplies the wording.
 */
import { Schema } from 'effect'

import type {
  CallbackName,
  CallbackPayload,
  CommandEmit,
  InjectedMemories,
  IntentKind,
  LoopContext,
  LoopEvent,
  LoopStateId,
  PromptEmit,
} from '../../core/machine'
import { memoryKey, skillKey } from '../../core/memory'
import type { SignalSpec, ToolSignal } from '../../core/signals'
import { renderTemplateFile } from './template-files'
import type { TemplateId, TemplateValues } from './template-files'

export type { TemplateId } from './template-files'

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

/**
What a spawn emits. The correlation id is assigned at delivery, so the action
stays deterministic.
*/
export type { SubagentEmit } from '../../core/machine'

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

/**
The part of the collect-actions argument `emit_parent` reads. The enqueue object
already carries `raise`, so the event stays on the library's internal queue.
*/
interface ParentRaiseArguments {
  readonly enqueue: { raise(event: { readonly type: string }): void }
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

const PROMPT_FALLBACK = 'Sent synthetic message: '

/**
The line a person sees beside a synthetic prompt. A prompt action supplies it;
an emit without one is named by the opening words of its text.
*/
export const promptDescription = (emit: Pick<PromptEmit, 'text' | 'description'>): string =>
  emit.description ?? PROMPT_FALLBACK + emit.text.slice(0, 20) + '...'

const sentence = (text: string): string => /[.!?]$/.test(text) ? text : text + '.'

/**
The values each template fills, with the defaults and joins the wording leaves
out. A template file names only the placeholders it uses; a key a value provider
omits is the unknown-placeholder error, so `detail` stays present as `undefined`.
*/
const IDLE_STATUS: Readonly<Record<string, string>> = {
  define_goal: 'Send SET_GOAL with the goal this session should accomplish.',
  work: 'Call signal_send with CLAIM_WORK when the current work unit is done.',
  check: 'The quality check is running; wait for its result instead of stopping.',
  validate: 'Answer the validation prompt, or send GOAL_ACHIEVED or GOAL_INCOMPLETE.',
  memorize: 'Send LESSON with what this attempt taught.',
  retrospective: 'Run the retrospective command and send RETROSPECTIVE_COMPLETE.',
}

const TEMPLATE_VALUES: Record<TemplateId, (context: LoopContext, state: string) => TemplateValues> = {
  goal_request: () => ({}),
  idle_nudge: (_context, state) => ({ state, status: IDLE_STATUS[state] ?? 'Continue the work this state waits for.' }),
  quality_check_failed: context => ({
    reason: context.failure?.reason ?? 'unknown',
    detail: context.failure?.detail,
  }),
  validation_self_report: () => ({}),
  memorize: context => ({ improvement: context.intent === 'improvement' }),
  panic_escalation: context => ({
    reason: context.failure?.reason ?? 'unknown',
    detail: context.failure?.detail,
  }),
  park_summary: context => ({
    goal: sentence(context.goal),
    improvements: sentence(context.improvements.join(' | ') || 'none'),
  }),
  work_towards_goal: context => ({
    goal: context.goal,
    memories: context.memories.join(' | ') || 'none',
    preferences: context.injected['preferences/user']?.full.join(' | ') || 'none',
  }),
}

export const renderTemplate = (parameters: PromptTemplate, context: LoopContext, state = ''): string =>
  renderTemplateFile(parameters.template, TEMPLATE_VALUES[parameters.template](context, state))

export const renderPrompt = (parameters: PromptParameters, context: LoopContext, state = ''): string => {
  if (parameters.text !== undefined) return parameters.text
  if (!('template' in parameters)) throw new Error('prompt action carries neither a template nor a text')

  return renderTemplate(parameters, context, state)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const leafOf = (value: unknown): string =>
  typeof value === 'string' ? value : (isObject(value) ? leafOf(Object.values(value).at(-1)) : '')

/**
A state's entry emits before the actor has initialized, when its snapshot cannot be
read; a template that does not name a state ignores the empty value.
*/
const leafState = (self: ActorSelf): string => {
  try {
    return leafOf(self.getSnapshot().value)
  }
  catch {
    return ''
  }
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
  if (parameters.op === 'fail') {
    return { failure: { reason: parameters.reason, detail: parameters.detail } }
  }

  if (parameters.op === 'increment') {
    return parameters.key === 'nudges' ? { nudges: context.nudges + 1 } : { attempts: context.attempts + 1 }
  }

  const value = readSource(event, parameters.source)

  if (parameters.op === 'push') {
    if (typeof value !== 'string') return {}

    const list = parameters.key === 'memories' ? context.memories : context.improvements
    const next = context.memoryLimit > 0 ? [...list, value].slice(-context.memoryLimit) : []

    return parameters.key === 'memories' ? { memories: next } : { improvements: next }
  }

  if (parameters.key === 'intent') return { intent: isIntentKind(value) ? value : context.intent }
  if (parameters.key === 'nudges') return { nudges: typeof value === 'number' ? value : context.nudges }
  return parameters.key === 'attempts' ? { attempts: typeof value === 'number' ? value : context.attempts } : { goal: typeof value === 'string' ? value : context.goal }
}

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

/**
A recalled memory is keyed by its namespace-qualified path: the `.md` extension
drops, the `mem:` prefix and `:complete` kind stay. The directory stays in the
key so two namespaces holding the same file name recall independently.
*/
const memoryToken = (namespace: string): string =>
  memoryKey(namespace.replace(/\.md$/, ''), 'complete')

/**
Memory keys kept per session; the oldest drop first.
*/
const MEMORY_TOKEN_LIMIT = 200

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

  if (payload.value === undefined || parameters.key === undefined) return { results }

  const token = memoryToken(parameters.key)
  const tokens = context.memoryTokens ?? []

  return tokens.includes(token)
    ? { results }
    : {
        results,
        injected: { ...context.injected, [parameters.key]: payload.value },
        memoryTokens: [...tokens, token].slice(-MEMORY_TOKEN_LIMIT),
      }
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
The actor's own snapshot: a prompt runs inside the active child, so the leaf state it names comes from there.
*/
interface ActorSelf {
  getSnapshot(): { readonly value: unknown }
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
  /**
  The id, not the leaf: a bare `parked` is compared against the whole state value,
  which is `{ towards_goal: 'parked' }` once parked sits under the compound.
  */
  not_parked: runtime.not(runtime.stateIn('#session.towards_goal.parked')),
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
