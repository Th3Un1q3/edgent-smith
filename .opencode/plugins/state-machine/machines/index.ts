/**
 * The machine registry: one entry per machine, each assembled from its own
 * directory in this folder. The core loads machines from here and holds none of
 * its own, so adding a machine costs one directory and one array entry.
 */
import sessionDefinition from './session/machine.json' with { type: 'json' }
import sessionManifest from './session/signals.manifest.json' with { type: 'json' }
import { createActions, createGuards } from './session/definitions'
import { freshContext, restoreContext, snapshotCodec } from './session/context'

import type { SnapshotCodec } from '../core/snapshot'

export interface MachineModule {
  readonly id: string
  readonly definition: unknown
  readonly manifest: unknown
  readonly transientStates: readonly string[]
  readonly definitions: {
    readonly createActions: typeof createActions
    readonly createGuards: typeof createGuards
  }
  readonly contexts: {
    readonly fresh: typeof freshContext
    readonly restore: typeof restoreContext
  }
}

export const MACHINES: readonly MachineModule[] = [
  {
    id: 'session',
    definition: sessionDefinition,
    manifest: sessionManifest,
    transientStates: ['check'],
    definitions: { createActions, createGuards },
    contexts: { fresh: freshContext, restore: restoreContext },
  },
]

export const DEFAULT_MACHINE: MachineModule = MACHINES[0]

/**
The snapshot declaration the session module owns: its context fields, its text
limit and its payload reader. Core carries these without naming any of them.
*/
export const DEFAULT_SNAPSHOT: SnapshotCodec = snapshotCodec

/**
Every declared state path, compound states and leaves alike, so a snapshot
naming a nested state validates against the chart rather than its top level.
*/
const statePathsOf = (states: Readonly<Record<string, unknown>>, prefix = ''): string[] =>
  Object.entries(states).flatMap(([id, config]) => {
    const path = prefix === '' ? id : prefix + '.' + id
    const nested = (config as { readonly states?: Readonly<Record<string, unknown>> }).states

    return nested === undefined ? [path] : [path, ...statePathsOf(nested, path)]
  })

export const DEFAULT_STATE_IDS: readonly string[] = statePathsOf(
  sessionDefinition.states as Readonly<Record<string, unknown>>,
)

export { CALLBACK_NAMES } from './session/context'
