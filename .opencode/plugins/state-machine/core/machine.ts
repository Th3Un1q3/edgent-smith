/**
 * The session state machine: one cohesive module for the loop, the machines, and
 * the messages they send. The entry file only registers this with opencode.
 */
import { Deferred, Effect } from 'effect'
import type { ActionFunction, GuardPredicate, MachineConfig, TransitionConfig } from 'xstate'
import type { PromptInput } from '@opencode/schema/prompt-input'
import type { AgentAttachment } from '@opencode/schema/prompt'
import type { SessionInbox } from '@opencode/schema/session-inbox'

import { DEFAULT_MACHINE } from '../machines'
import type { MachineModule } from '../machines'
import type { CallbackPayload, InjectedMemories, LoopContext } from '../machines/session/context'

export type { CallbackPayload, Failure, InjectedMemories, IntentKind, LoopContext } from '../machines/session/context'
import { manifestCodec, refusalMessage, renderSignals, stateLeaf, stateValuePath, validateSignal } from './signals'
import type { SignalRefusal, SignalSpec, SignalSources, SignalTable } from './signals'
import type { PersistedSnapshot, SnapshotStore, ToolPolicyRule } from './snapshot'

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

/**
The signals the default machine's manifest declares, in manifest order.
*/
export const TOOL_SIGNALS: readonly string[] = Object.freeze(
  Object.keys((DEFAULT_MACHINE.manifest as { readonly signals?: Readonly<Record<string, unknown>> }).signals ?? {}),
)

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
The name→spec table for one policy: only the names it enables, each resolved
through the one registry. A session with no policy leaves nothing available.
*/
const policyTable = (registry: Readonly<Record<string, SignalSpec>>, policy: SignalsPolicy | undefined): SignalTable => {
  // A null prototype keeps an inherited name (`constructor`, `__proto__`) out of
  // the table, so only a name the registry declares can be enabled.
  const table: Record<string, SignalSpec> = Object.create(null) as Record<string, SignalSpec>

  for (const name of policy?.names ?? []) {
    const spec = Object.hasOwn(registry, name) ? registry[name] : undefined

    if (spec !== undefined) table[name] = spec
  }

  return table
}

interface NestedStates<T> {
  readonly states?: Readonly<Record<string, T>>
}

type RawStateConfig = NestedStates<RawStateConfig> & {
  readonly [key: string]: unknown
  readonly on?: Readonly<Record<string, LoopArm | readonly LoopArm[]>>
  readonly always?: LoopArm | readonly LoopArm[]
}

interface MachineDefinitionData extends NestedStates<RawStateConfig> {
  readonly id: string
  readonly initial?: string
  readonly on?: LoopOn
  readonly states: Readonly<Record<string, RawStateConfig>>
}

/**
Every declared state as a dotted path, compound states included, so a stored
snapshot value and a target can both be checked against the whole tree.
*/
const statePathsOf = (states: Readonly<Record<string, NestedStates<unknown>>>, prefix = ''): string[] =>
  Object.entries(states).flatMap(([id, config]) => {
    const path = prefix === '' ? id : prefix + '.' + id
    const children = config.states as Readonly<Record<string, NestedStates<unknown>>> | undefined

    return children === undefined ? [path] : [path, ...statePathsOf(children, path)]
  })

const hasStatePath = (states: Readonly<Record<string, NestedStates<unknown>>>, path: string): boolean => {
  let level: Readonly<Record<string, NestedStates<unknown>>> | undefined = states

  for (const segment of path.split('.')) {
    const config: NestedStates<unknown> | undefined = level?.[segment]

    if (config === undefined) return false

    level = config.states as Readonly<Record<string, NestedStates<unknown>>> | undefined
  }

  return true
}

/**
A deep clone of the declaration with the metadata that is ours (`signals`) removed,
so `initial`, nested states and `always` arms reach the state library as written.
*/
const withoutSignals = (config: RawStateConfig): RawStateConfig => {
  const clone = structuredClone(config) as unknown as Record<string, unknown>

  delete clone.signals

  if (clone.states !== undefined) {
    clone.states = Object.fromEntries(
      Object.entries(clone.states as Readonly<Record<string, RawStateConfig>>)
        .map(([id, child]) => [id, withoutSignals(child)]),
    )
  }

  return clone as unknown as RawStateConfig
}

const definitionOf = (module: MachineModule): MachineDefinitionData => {
  const raw = module.definition

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('machine ' + module.id + ' carries no definition object')
  }

  const definition = withoutSignals(raw as RawStateConfig)

  if (typeof definition.id !== 'string' || definition.id === '') {
    throw new Error('machine ' + module.id + ' declares no id')
  }

  if (typeof definition.states !== 'object' || definition.states === null || Array.isArray(definition.states)) {
    throw new Error('machine ' + definition.id + ' declares no states')
  }

  if (Object.keys(definition.states).length === 0) throw new Error('machine ' + definition.id + ' declares no states')

  return definition as unknown as MachineDefinitionData
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

const sourcesOf = (module: MachineModule): SignalSources => {
  const manifest = module.manifest

  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    throw new Error('machine ' + module.id + ' carries no signal manifest')
  }

  const signals = (manifest as { readonly signals?: unknown }).signals

  if (typeof signals !== 'object' || signals === null || Array.isArray(signals)) {
    throw new Error('machine ' + module.id + ' declares no signals')
  }

  const declared = signals as SignalSources['signals']
  const codecs: Record<string, SignalSpec['schema']> = {}

  for (const [name, signal] of Object.entries(declared)) {
    const codec = manifestCodec(signal)

    if (codec !== undefined) codecs[name] = codec
  }

  return { signals: declared, codecs }
}

interface ModuleDefinitions {
  readonly createSignalRegistry?: (definition: unknown, sources: SignalSources) => Readonly<Record<string, SignalSpec>>
}

/**
Builds the signal registry from the manifest when the module supplies no registry
builder of its own. A module that needs ad-hoc aliases supplies one in its
definitions.
*/
const registryOf = (
  module: MachineModule,
  definition: MachineDefinitionData,
  sources: SignalSources,
): Readonly<Record<string, SignalSpec>> => {
  const supplied = (module.definitions as unknown as ModuleDefinitions).createSignalRegistry

  if (typeof supplied === 'function') return supplied(definition, sources)

  const registry: Record<string, SignalSpec> = {}

  for (const [name, signal] of Object.entries(sources.signals)) {
    const schema = sources.codecs[name]

    registry[name] = schema === undefined ? { describe: signal.describe } : { describe: signal.describe, schema }
  }

  return registry
}

const stateEntriesOf = (
  states: Readonly<Record<string, RawStateConfig>>,
  prefix = '',
): ReadonlyArray<readonly [string, RawStateConfig]> =>
  Object.entries(states).flatMap(([id, config]) => {
    const path = prefix === '' ? id : prefix + '.' + id
    const children = config.states === undefined ? [] : stateEntriesOf(config.states, path)

    return [[path, config] as const, ...children]
  })

const parentPath = (path: string): string => {
  const cut = path.lastIndexOf('.')

  return cut === -1 ? '' : path.slice(0, cut)
}

const childPath = (parent: string, key: string): string => parent === '' ? key : parent + '.' + key

/**
A target may name a sibling, a dotted path, or an id (`#session.towards_goal.validate`).
*/
const hasTarget = (declared: ReadonlySet<string>, rootId: string, path: string, target: string): boolean => {
  if (target.startsWith('#')) {
    const prefix = '#' + rootId + '.'

    return target === '#' + rootId || (target.startsWith(prefix) && declared.has(target.slice(prefix.length)))
  }

  return target.startsWith('.') ? declared.has(childPath(parentPath(path), target.slice(1))) : declared.has(childPath(parentPath(path), target)) || declared.has(target)
}

const armsOf = (config: RawStateConfig): readonly LoopArm[] => {
  const on = Object.values(config.on ?? {}).flatMap(arm => Array.isArray(arm) ? arm : [arm])
  const always = config.always === undefined ? [] : (Array.isArray(config.always) ? config.always : [config.always])

  return [...on, ...always]
}

/**
A transition into a state the definition does not declare would fail on arrival
rather than at load, so every assembled machine is checked once, here.
*/
const assertTargets = (definition: MachineDefinitionData): void => {
  const declared = new Set(statePathsOf(definition.states))

  for (const [path, config] of stateEntriesOf(definition.states)) {
    for (const arm of armsOf(config)) {
      const target = arm.target

      if (typeof target === 'string' && !hasTarget(declared, definition.id, path, target)) {
        throw new Error('machine ' + definition.id + ' state ' + path + ' targets ' + target + ', which it does not declare')
      }
    }
  }
}

/**
The assembly cache: session state lives in the actor and in the machine's own
maps, so one assembly per module is safe to share. The weak key keeps a module
that is no longer imported collectable.
*/
const assemblies = new WeakMap<MachineModule, AssembledMachine>()

/**
Builds the loop and the registry for one module, so core holds no machine of its
own: the state ids, the transitions and the ad-hoc signals all come from the
module. The consistency checks run once per module, on first assembly.
*/
export const assembleMachine = (module: MachineModule): AssembledMachine => {
  const cached = assemblies.get(module)

  if (cached !== undefined) return cached

  const definition = definitionOf(module)

  assertTargets(definition)

  // Already a clone with our metadata stripped: the library receives the tree whole.
  const loop = definition as unknown as LoopDefinition
  const sources = sourcesOf(module)
  const assembled: AssembledMachine = {
    loop,
    registry: registryOf(module, definition, sources),
    sources,
    transientStates: new Set(module.transientStates),
  }

  assemblies.set(module, assembled)

  return assembled
}

export const SESSION_MACHINE: AssembledMachine = assembleMachine(DEFAULT_MACHINE)

export const SESSION_LOOP: LoopDefinition = SESSION_MACHINE.loop

export const LOOP_STATE_IDS: readonly LoopStateId[] = Object.keys(SESSION_LOOP.states) as LoopStateId[]

export const LOOP_STATE_PATHS: readonly LoopStateId[] = statePathsOf(
  SESSION_LOOP.states as unknown as Readonly<Record<string, NestedStates<unknown>>>,
)

export const acceptedTransitions = (state: LoopStateId): readonly string[] => {
  const on = (SESSION_LOOP.states[state] as { readonly on?: Readonly<Record<string, unknown>> } | undefined)?.on

  return TOOL_SIGNALS.filter(signal => on?.[signalEvent(signal)] !== undefined)
}

/**
 * The agent-to-starting-state mapping, read once. An entry naming a state the
 * loop does not declare is reported rather than defaulted.
 */
export const readStartConfig = (
  startStates: Readonly<Record<string, string>>,
  stateIds: ReadonlySet<string> = new Set(LOOP_STATE_PATHS),
): {
  readonly startStateFor: (agent: string) => LoopStateId | undefined
  readonly invalidAgents: readonly string[]
} => {
  const mapped = new Map<string, LoopStateId>()
  const invalidAgents: string[] = []

  for (const [agent, state] of Object.entries(startStates)) {
    if (stateIds.has(state)) {
      mapped.set(agent, state)
    }
    else { invalidAgents.push(agent) }
  }

  return { startStateFor: agent => mapped.get(agent), invalidAgents }
}

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

      // A payload the library cannot place comes back as an error actor rather
      // than a throw, so the session falls back to its initial state here.
      const actor = candidate !== undefined && candidate.getSnapshot().status !== 'error' ? candidate : createActor(created)
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

const NO_MACHINE_MESSAGE = 'No state machine is running for this session.'

interface StateMachineOptions {
  readonly library: StateMachineLibrary
  readonly machine?: MachineModule
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
  readonly snapshot?: 'restored' | 'fresh' | 'read-failed' | 'expired' | 'shape-invalid' | 'legacy'
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
  Creates the session's machine at admission; never on a signal.
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
  The rendered signal list for the session's policy.
  */
  signalLine: (sessionId: string, signal_keys?: readonly string[]) => string
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
  const module = options.machine ?? DEFAULT_MACHINE
  const assembly = assembleMachine(module)
  const stateIds: ReadonlySet<string> = new Set(
    statePathsOf(assembly.loop.states as unknown as Readonly<Record<string, NestedStates<unknown>>>),
  )
  const initialState: LoopStateId
    = (assembly.loop.initial as LoopStateId | undefined) ?? (Object.keys(assembly.loop.states)[0] as LoopStateId)
  const machines = new Map<string, MachineEntry>()
  const waiting = new Map<string, Deferred.Deferred<SessionStart | undefined>>()

  /**
  A transient state is left behind on restore whether the module declares it at
  the root or inside a compound state.
  */
  const isTransient = (state: LoopStateId): boolean =>
    assembly.transientStates.has(state) || assembly.transientStates.has(state.slice(state.lastIndexOf('.') + 1))

  /**
  The actor's own context: the tool policy lives there, installed by the entry
  action and cleared by the exit action, so a transition keeps it in step.
  */
  const liveContext = (entry: MachineEntry): MachineContext => entry.actor.context()

  const view = (entry: MachineEntry): SessionMachine => ({
    sessionId: entry.sessionId,
    agent: entry.agent,
    state: entry.actor.state(),
    context: liveContext(entry) as unknown as LoopContext,
  })

  const contextFor = (sessionId: string, agent: string, parentID: string | undefined): MachineContext =>
    module.contexts.fresh({ sessionId, agent, parentID, maxAttempts: options.maxAttempts, memoryLimit: options.memoryLimit })

  const restoredContext = (stored: Readonly<Record<string, unknown>>, agent: string, parentID: string | undefined): MachineContext =>
    module.contexts.restore(stored, {
      sessionId: String(stored.sessionId),
      agent,
      parentID,
      maxAttempts: options.maxAttempts,
      memoryLimit: options.memoryLimit,
    })

  const create = (
    sessionId: string,
    agent: string,
    context: MachineContext,
    parentID: string | undefined,
    restored?: PersistedSnapshot,
  ): SessionStart => {
    const actor = options.library.createActor(assembly.loop, initialState, context, restored)
    const entry: MachineEntry = { actor, sessionId, agent, pending: [] }

    // A session is created before its agent is known; `admit` is how `admission`
    // leaves the state it entered while the identity was empty.
    entry.actor.send({ type: 'admit', agent, parentID })

    if (actor.restored === true) entry.actor.takeEmits()
    else entry.pending = [...entry.actor.takeEmits()]

    machines.set(sessionId, entry)

    return {
      machine: view(entry),
      created: true,
      emits: [],
      snapshot: actor.restored === true ? 'restored' : 'fresh',
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

  const start = (sessionId: string, agent: string, parentID?: string): SessionStart | undefined => {
    const existing = machines.get(sessionId)

    return existing === undefined ? create(sessionId, agent, contextFor(sessionId, agent, parentID), parentID) : { machine: view(existing), created: false, emits: [] }
  }

  const load = (sessionId: string, agent: string, parentID?: string): Effect.Effect<SessionStart | undefined> => Effect.gen(function* () {
    const snapshot = options.snapshot

    if (snapshot === undefined) return start(sessionId, agent, parentID)

    const read = yield* snapshot.read(sessionId, stateIds)

    if (read.status === 'rejected') return

    if (read.status === 'absent') {
      if (read.reason === 'legacy') {
        yield* Effect.logInfo('[state-machine] snapshot state-machine/' + sessionId + ' v1 record, starting fresh')
      }

      const started = create(sessionId, agent, contextFor(sessionId, agent, parentID), parentID)

      return read.reason === 'missing' ? started : { ...started, snapshot: read.reason }
    }

    const stored = read.record.snapshot
    const path = stateValuePath(stored.value)
    const isUsable = stored.status !== 'error'
      && path !== ''
      && !isTransient(path)
      && hasStatePath(assembly.loop.states as unknown as Readonly<Record<string, NestedStates<unknown>>>, path)

    return isUsable
      ? create(sessionId, agent, restoredContext(stored.context as Readonly<Record<string, unknown>>, agent, parentID), parentID, stored)
      : { ...create(sessionId, agent, contextFor(sessionId, agent, parentID), parentID), snapshot: 'shape-invalid' }
  })

  const ensure = (sessionId: string, agent: string, parentID?: string): Effect.Effect<SessionStart | undefined> => Effect.suspend(() => {
    const existing = machines.get(sessionId)

    if (existing !== undefined) return Effect.succeed<SessionStart | undefined>({ machine: view(existing), created: false, emits: [] })

    const waitingOn = waiting.get(sessionId)

    if (waitingOn !== undefined) return Deferred.await(waitingOn)

    const deferred = Deferred.makeUnsafe<SessionStart | undefined>()

    waiting.set(sessionId, deferred)

    const settle = (value: SessionStart | undefined): Effect.Effect<SessionStart | undefined> =>
      Deferred.succeed(deferred, value).pipe(Effect.andThen(Effect.succeed(value)))

    return load(sessionId, agent, parentID).pipe(
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
      : snapshot.write(entry.actor.persistedSnapshot()).pipe(
          Effect.map(ok => ok ? 'written' as const : 'write-failed' as const),
          Effect.catchCause(() => Effect.succeed('write-failed' as const)),
        )
  })

  /**
  Any event means the loop is awake: a held goal request must not arrive late.
  */
  const markAwake = (entry: MachineEntry): void => {
    entry.pending = []
  }

  /**
  The one path an event takes: sent through the actor, the held entry emits
  cleared, then what the actor emitted drained, in that order.
  */
  const dispatch = (entry: MachineEntry, event: LoopEvent): readonly EmitRequest[] => {
    entry.actor.send(event)
    markAwake(entry)
    return entry.actor.takeEmits()
  }

  const signal = (input: unknown, sessionId: string): SignalResult => {
    const entry = machines.get(sessionId)

    if (entry === undefined) return { text: NO_MACHINE_MESSAGE, emits: [] }

    const state = entry.actor.state()
    const table = policyTable(assembly.registry, liveContext(entry).signalsPolicy)
    const validation = validateSignal(input, state, table, assembly.registry)

    return validation.ok
      ? {
          text: 'Signal accepted.',
          emits: dispatch(entry, validation.event),
        }
      : {
          text: refusalMessage(validation.refusal, table),
          emits: [],
          refusal: validation.refusal,
        }
  }

  const status = (sessionId: string): string => {
    const entry = machines.get(sessionId)

    return entry === undefined ? NO_MACHINE_MESSAGE : 'State: ' + stateLeaf(entry.actor.state()) + '.'
  }

  const signalLine = (sessionId: string, signal_keys?: readonly string[]): string => {
    const entry = machines.get(sessionId)

    return entry === undefined
      ? 'Signals now: none'
      : renderSignals(policyTable(assembly.registry, liveContext(entry).signalsPolicy), signal_keys)
  }

  const callback = (
    sessionId: string,
    name: CallbackName,
    payload: CallbackPayload,
  ): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    return entry === undefined ? [] : dispatch(entry, { type: callbackEvent(name), payload })
  }

  const userInput = (sessionId: string, text: string): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    return entry === undefined ? [] : dispatch(entry, { type: 'system_user_input', text })
  }

  const interrupted = (sessionId: string, reason: InterruptReason): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    return entry === undefined ? [] : dispatch(entry, { type: 'system_interrupted', reason })
  }

  const idle = (sessionId: string): Effect.Effect<readonly EmitRequest[]> =>
    Effect.sync(() => {
      const entry = machines.get(sessionId)

      return entry === undefined ? [] : dispatch(entry, { type: 'system_idle' })
    })

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
