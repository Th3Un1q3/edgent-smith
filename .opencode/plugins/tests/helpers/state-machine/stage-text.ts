import { readFileSync } from 'node:fs'
import path from 'node:path'

import { renderPromptText } from '@plugins/state-machine/machines/session/prompt-template'

import { REPO_ROOT } from '@tests/helpers/repo-root'

import type { LoopContext } from '@plugins/state-machine/core/machine'

/**
 * The stage ids the tests name a prompt by; each maps to the `prompt` action
 * `machine.json` holds for that stage, and the expected text is that action's
 * template rendered by the production renderer.
 */
export type StageId
  = | 'goal_request'
    | 'idle_nudge'
    | 'memorize'
    | 'panic_escalation'
    | 'park_summary'
    | 'plan_stage'
    | 'quality_check_failed'
    | 'retrospective_stage'
    | 'validation_self_report'
    | 'work_towards_goal'

/**
The path inside `machine.json` to the `prompt` action for each stage. A stage
guarded by two prompt arms maps to its first arm.
*/
const TEMPLATE_PATH: Readonly<Record<StageId, readonly (string | number)[]>> = {
  goal_request: ['states', 'towards_goal', 'states', 'define_goal', 'entry', 0],
  idle_nudge: ['states', 'towards_goal', 'on', 'system_idle', 0, 'actions', 1],
  memorize: ['states', 'towards_goal', 'states', 'memorize', 'entry', 0],
  panic_escalation: ['states', 'towards_goal', 'on', 'system_idle', 1, 'actions', 1],
  park_summary: ['states', 'towards_goal', 'states', 'parked', 'entry', 0],
  plan_stage: ['states', 'towards_goal', 'states', 'plan', 'entry', 0],
  quality_check_failed: [
    'states', 'towards_goal', 'states', 'check', 'on', 'callback.quality_check_ready', 1, 'actions', 1,
  ],
  retrospective_stage: ['states', 'towards_goal', 'states', 'retrospective', 'entry', 0],
  validation_self_report: ['states', 'towards_goal', 'states', 'validate', 'entry', 0],
  work_towards_goal: ['states', 'towards_goal', 'states', 'work', 'entry', 0],
}

const MACHINE_PATH = '.opencode/plugins/state-machine/machines/session/machine.json'

const MACHINE: unknown = JSON.parse(readFileSync(path.join(REPO_ROOT, MACHINE_PATH), 'utf8'))

const at = (root: unknown, keys: readonly (string | number)[]): unknown =>
  keys.reduce<unknown>((node, key) => (node as Record<string | number, unknown>)[key], root)

const template = (id: StageId): string => {
  const action = at(MACHINE, TEMPLATE_PATH[id]) as { params: { text: unknown } }
  const text = action.params.text

  if (typeof text !== 'string') throw new Error('no prompt template in machine.json for ' + id)

  return text
}

/**
A value no template scope can emit, so a render can be split at its first variable.
*/
const MARK = '\u{0}value\u{0}'

export interface StageValues {
  readonly goal?: string
  readonly improvements?: string | readonly string[]
  readonly memories?: readonly string[]
  readonly preferences?: readonly string[]
  readonly reason?: string
  readonly detail?: string
  readonly improvement?: boolean
  readonly state?: string
}

type Values = Record<string, unknown>

const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : []

const baseContext = (): LoopContext => ({
  goal: 'ship it',
  attempts: 0,
  intent: 'none',
  memories: [],
  improvements: [],
  memoryLimit: 3,
  injected: {},
  injectedSkills: [],
  memoryTokens: [],
  results: {},
  signalsPolicy: { names: [] },
} as unknown as LoopContext)

const stringOr = (value: unknown, fallback: string): string => typeof value === 'string' ? value : fallback

const stringList = (value: unknown): string[] => typeof value === 'string' ? [value] : strings(value)

const preferencesInjection = (preferences: string[]): Record<string, unknown> =>
  preferences.length === 0 ? {} : { 'preferences/user': { full: preferences, index: [] } }

const detailEntry = (value: unknown): { detail?: string } => typeof value === 'string' ? { detail: value } : {}

const failureEntry = (values: Values): Record<string, unknown> => {
  return typeof values.reason === 'string' ? { failure: { reason: values.reason, ...detailEntry(values.detail) } } : {}
}

const contextFrom = (values: Values): LoopContext => {
  const preferences = strings(values.preferences)

  return {
    ...baseContext(),
    goal: stringOr(values.goal, 'ship it'),
    intent: values.improvement === true ? 'improvement' : 'none',
    memories: strings(values.memories),
    improvements: stringList(values.improvements),
    injected: preferencesInjection(preferences),
    ...failureEntry(values),
  } as unknown as LoopContext
}

const stateOrWork = (value: unknown): string => typeof value === 'string' ? value : 'work'

const render = (id: StageId, values: Values): string =>
  renderPromptText(template(id), { context: contextFrom(values), state: stateOrWork(values.state) })

/**
 * The raw `text` template `machine.json` declares for this stage, before rendering;
 * the machine definition carries exactly this string.
 */
export const stageTemplate = (id: StageId): string => template(id)

/**
 * The text `machine.json` ships for this stage, rendered with the fixture's own
 * values by the production renderer.
 */
export const stageText = (id: StageId): string => render(id, {})

/**
 * The stage text rendered from the supplied values by the production renderer,
 * so goal, memories and failure resolve exactly as the machine emits them.
 */
export const stageRendered = (id: StageId, values: StageValues = {}): string =>
  render(id, values as Values)

/**
 * The literal text before the stage's first variable; empty when it opens with one.
 */
export const stageStart = (id: StageId): string => {
  const text = render(id, {
    goal: MARK,
    memories: [MARK],
    improvements: [MARK],
    preferences: [MARK],
    reason: MARK,
    state: MARK,
  })
  const index = text.indexOf(MARK)

  return index === -1 ? text : text.slice(0, index)
}

/**
 * The literal text after the stage's last variable; the whole text when it has none.
 */
export const stageEnd = (id: StageId): string => {
  const text = render(id, {
    goal: MARK,
    memories: [MARK],
    improvements: [MARK],
    preferences: [MARK],
    reason: MARK,
    state: MARK,
  })
  const index = text.lastIndexOf(MARK)

  return index === -1 ? text.trim() : text.slice(index + MARK.length).trim()
}
