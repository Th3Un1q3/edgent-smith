import { Schema } from 'effect'

import type { SignalSpec, ToolSignal } from '../../core/signals'

import type { AdHocSignal, UpdateSignalsPolicyParameters } from './definition-contract'
import { isObject } from './payload-readers'

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

const specWithSchema = (describe: string, schema: SignalSpec['schema'] | undefined): SignalSpec =>
  schema === undefined ? { describe } : { describe, schema }

const aliasSpec = (name: string, alias: AdHocSignal, sources: SignalSources): SignalSpec => {
  if (alias.description.trim() === '') {
    throw new Error('update_signals_policy gives ' + name + ' a blank description')
  }

  return alias.schema === undefined ? { describe: alias.description } : specWithSchema(alias.description, manifestSpec(alias.schema, sources).schema)
}

/**
The signals one policy enables, in the order it names them, with the prose and
codec the machine validates against. A name the manifest does not declare throws
when the machine is assembled, rather than enabling a signal nothing answers.
*/
const aliasSpecs = (
  entry: Readonly<Record<string, AdHocSignal>>,
  sources: SignalSources,
): Readonly<Record<string, SignalSpec>> => {
  const aliases = Object.entries(entry)

  if (aliases.length === 0) {
    throw new Error('update_signals_policy enables an object that names no signal')
  }

  return Object.fromEntries(aliases.map(([name, alias]) => [name, aliasSpec(name, alias, sources)]))
}

export const updateSignalsPolicySpecs = (
  parameters: UpdateSignalsPolicyParameters,
  sources: SignalSources,
): Readonly<Record<string, SignalSpec>> => {
  const specs: Record<string, SignalSpec> = {}

  for (const entry of parameters.set_enabled_signals) {
    if (typeof entry === 'string') specs[entry] = manifestSpec(entry, sources)
    else Object.assign(specs, aliasSpecs(entry, sources))
  }

  return specs
}

const isPolicyUpdate = (action: unknown): action is { readonly params: unknown } =>
  isObject(action) && action.type === 'update_signals_policy'

const isPolicyParameters = (parameters: unknown): parameters is UpdateSignalsPolicyParameters =>
  isObject(parameters) && Array.isArray(parameters.set_enabled_signals)

const policyParametersOf = (action: unknown): readonly UpdateSignalsPolicyParameters[] => {
  if (!isPolicyUpdate(action)) return []

  const { params } = action

  return isPolicyParameters(params) ? [params] : []
}

const policyParameters = (actions: unknown): readonly UpdateSignalsPolicyParameters[] => {
  const list = actions === undefined ? [] : (Array.isArray(actions) ? actions : [actions])

  return list.flatMap(action => policyParametersOf(action))
}

const armParameters = (arm: unknown): readonly UpdateSignalsPolicyParameters[] =>
  (Array.isArray(arm) ? arm : [arm]).flatMap(single =>
    policyParameters(isObject(single) ? single.actions : undefined))

const policyParametersOfState = (
  state: Record<string, unknown>,
): readonly UpdateSignalsPolicyParameters[] => {
  const own = [...policyParameters(state.entry), ...policyParameters(state.exit)]

  return isObject(state.on) ? [...own, ...Object.values(state.on).flatMap(arm => armParameters(arm))] : own
}

export const declaredPolicyParameters = (definition: unknown): readonly UpdateSignalsPolicyParameters[] => {
  return !isObject(definition) || !isObject(definition.states)
    ? []
    : Object.values(definition.states).filter(isObject).flatMap(state => policyParametersOfState(state))
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
  const registry: Record<string, SignalSpec> = Object.fromEntries(
    Object.keys(sources.signals).map((name): [string, SignalSpec] => [name, manifestSpec(name, sources)]),
  )

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
