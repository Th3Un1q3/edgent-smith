import { DEFAULT_MACHINE } from '../machines'
import type { MachineModule } from '../machines'

import { manifestCodec } from './signals'
import type { SignalSpec, SignalSources } from './signals'
import type { AssembledMachine, LoopArm, LoopDefinition, LoopOn, LoopStateId } from './machine-contract'
import { signalEvent } from './machine-contract'

/**
The signals the default machine's manifest declares, in manifest order.
*/
export const TOOL_SIGNALS: readonly string[] = Object.freeze(
  Object.keys((DEFAULT_MACHINE.manifest as { readonly signals?: Readonly<Record<string, unknown>> }).signals ?? {}),
)

export interface NestedStates<T> {
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
export const statePathsOf = (states: Readonly<Record<string, NestedStates<unknown>>>, prefix = ''): string[] =>
  Object.entries(states).flatMap(([id, config]) => {
    const path = prefix === '' ? id : prefix + '.' + id
    const children = config.states as Readonly<Record<string, NestedStates<unknown>>> | undefined

    return children === undefined ? [path] : [path, ...statePathsOf(children, path)]
  })

export const hasStatePath = (states: Readonly<Record<string, NestedStates<unknown>>>, path: string): boolean => {
  let level: Readonly<Record<string, NestedStates<unknown>>> | undefined = states

  return path.split('.').every((segment) => {
    const config: NestedStates<unknown> | undefined = level?.[segment]

    level = config?.states as Readonly<Record<string, NestedStates<unknown>>> | undefined

    return config !== undefined
  })
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

const isObjectRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasStates = (states: unknown): boolean =>
  isObjectRecord(states) && Object.keys(states).length > 0

/**
A definition without an id, or without one declared state, has nothing to assemble.
*/
const hasDeclaredId = (definition: RawStateConfig): boolean =>
  typeof definition.id === 'string' && definition.id !== ''

const assertDefinitionShape = (definition: RawStateConfig, moduleId: string): void => {
  if (!hasDeclaredId(definition)) {
    throw new Error('machine ' + moduleId + ' declares no id')
  }

  if (!hasStates(definition.states)) {
    throw new Error('machine ' + String(definition.id) + ' declares no states')
  }
}

const definitionOf = (module: MachineModule): MachineDefinitionData => {
  const raw = module.definition

  if (!isObjectRecord(raw)) {
    throw new Error('machine ' + module.id + ' carries no definition object')
  }

  const definition = withoutSignals(raw as RawStateConfig)

  assertDefinitionShape(definition, module.id)

  return definition as unknown as MachineDefinitionData
}

/**
Both halves of the manifest contract, checked before a signal name can be looked up.
*/
const requireSignals = (manifest: unknown, moduleId: string): SignalSources['signals'] => {
  if (!isObjectRecord(manifest)) throw new Error('machine ' + moduleId + ' carries no signal manifest')

  const signals = manifest.signals

  if (!isObjectRecord(signals)) throw new Error('machine ' + moduleId + ' declares no signals')

  return signals as unknown as SignalSources['signals']
}

const sourcesOf = (module: MachineModule): SignalSources => {
  const declared = requireSignals(module.manifest, module.id)
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
const signalSpecOf = (signal: SignalSpec, schema: SignalSpec['schema']): SignalSpec =>
  schema === undefined ? { describe: signal.describe } : { describe: signal.describe, schema }

const registryOf = (
  module: MachineModule,
  definition: MachineDefinitionData,
  sources: SignalSources,
): Readonly<Record<string, SignalSpec>> => {
  const supplied = (module.definitions as unknown as ModuleDefinitions).createSignalRegistry

  if (typeof supplied === 'function') return supplied(definition, sources)

  const registry: Record<string, SignalSpec> = {}

  for (const [name, signal] of Object.entries(sources.signals)) {
    registry[name] = signalSpecOf(signal, sources.codecs[name])
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

const targetCandidates = (base: string, target: string): readonly string[] =>
  target.startsWith('.') ? [childPath(base, target.slice(1))] : [childPath(base, target), target]

/**
A target may name a sibling, a dotted path, or an id (`#session.towards_goal.validate`).
*/
const hasTarget = (declared: ReadonlySet<string>, rootId: string, path: string, target: string): boolean => {
  const absolute = '#' + rootId

  if (target === absolute) return true
  if (target.startsWith(absolute + '.')) return declared.has(target.slice(absolute.length + 1))

  const candidates = targetCandidates(parentPath(path), target)

  return candidates.some(candidate => declared.has(candidate))
}

const asArms = (arm: LoopArm | readonly LoopArm[] | undefined): readonly LoopArm[] =>
  arm === undefined ? [] : [arm].flat()

const armsOf = (config: RawStateConfig): readonly LoopArm[] => [
  ...Object.values(config.on ?? {}).flatMap(arm => asArms(arm)),
  ...asArms(config.always),
]

/**
A transition into a state the definition does not declare would fail on arrival
rather than at load, so every assembled machine is checked once, here.
*/
const hasUndeclaredTarget = (
  declared: ReadonlySet<string>,
  rootId: string,
  path: string,
  target: unknown,
): boolean => typeof target === 'string' && !hasTarget(declared, rootId, path, target)

const assertTargets = (definition: MachineDefinitionData): void => {
  const declared = new Set(statePathsOf(definition.states))

  for (const [path, target] of stateEntriesOf(definition.states).flatMap(([path, config]) =>
    armsOf(config).map(arm => [path, arm.target] as const))) {
    if (hasUndeclaredTarget(declared, definition.id, path, target)) {
      throw new Error('machine ' + definition.id + ' state ' + path + ' targets ' + target + ', which it does not declare')
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
  const entries = Object.entries(startStates)
  const mapped = new Map<string, LoopStateId>(entries.filter(([, state]) => stateIds.has(state)))
  const invalidAgents = entries.filter(([, state]) => !stateIds.has(state)).map(([agent]) => agent)

  return { startStateFor: agent => mapped.get(agent), invalidAgents }
}
