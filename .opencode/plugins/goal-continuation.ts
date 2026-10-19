/**
 * goal-continuation — OpenCode v2 Effect plugin (ADR-008).
 *
 * Owns three parts in one `effect` closure: the `goal` tool, the goal-first
 * enforcement gate (`execute.before`), and the idle nudge loop (`session.idle`).
 *
 * Persisted state (one record per session each):
 *   goal/<sessionID>      -> { text: string, nudges: number }          // absent key means done
 *   goal-gate/<sessionID> -> { armed: boolean, goalSet: boolean, steeringSent: number }
 *
 * The gate state is persisted so a plugin hot reload (v2 rebuilds the effect
 * closure) does not lose it and re-arm a session mid-iteration. The in-memory
 * `Map` stays as a write-through cache hydrated by a load-time scan. Sends are
 * swallowed with `Effect.ignore`: the promise-named catch-all trips
 * `unicorn/prefer-await` under non-type-aware lint.
 */
import { Effect, Stream } from 'effect'
import type { JsonSchema } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import type { Agent } from '@opencode/schema/agent'
import type { Session } from '@opencode/schema/session'
import { Tool } from '@opencode/schema/tool'

import { harnessConfig } from './config/harness.config'
import { MAX_NUDGES } from './helpers/goal-nudges'
import type { GoalEnforcementConfig } from './types/goal-enforcement'

const GOAL_TOOL = 'goal'
const GOAL_PREFIX = 'goal/'

/**
Orchestrators allowed to call `goal` regardless of enforcement config.
*/
const ALLOWED_ORCHESTRATORS = new Set(['rug', 'rug-workflow', 'rug-team-coach'])

type GoalRecord = {
  text: string
  nudges: number
}

type GateState = {
  armed: boolean
  goalSet: boolean
  steeringSent: number
}

/**
 * `context.event.subscribe` is unary: it exposes the whole `OpenCodeEvent` union
 * and takes no event-type argument, so a specific type is selected with
 * `Stream.filter`, whose predicate narrows the union.
 */
type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

const isIdle = (event: PluginEvent): event is Extract<PluginEvent, { type: 'session.idle' }> =>
  event.type === 'session.idle'

const goalKey = (sessionID: string): string => GOAL_PREFIX + sessionID

const REGEX_SPECIALS = '.+^${}()|[]\\'

/**
Mirrors the runtime `Permission` matcher: `*` matches any run, `?` a single
character, anchored and case-sensitive.
*/
const isGlobMatch = (value: string, pattern: string): boolean => {
  let source = ''
  for (const char of pattern) {
    if (char === '*') source += '.*'
    else if (char === '?') source += '.'
    else source += REGEX_SPECIALS.includes(char) ? '\\' + char : char
  }
  return new RegExp('^' + source + '$', 's').test(value)
}

const nudgeText = (text: string): string =>
  `Goal still open: "${text}". Continue, or call goal.clear if done.`

const steeringText = (tool: string): string =>
  '<steering priority="high" reason="tool \'' + tool + '\' blocked: no goal set for this turn" type="instructions">\n'
  + 'Goal-first gate: call `goal` with {"action":"set","text":"<this turn\'s goal>"} before using \'' + tool + '\'.\n'
  + 'Read-only tools (question, read, glob, grep, skill) remain available. When the turn is complete,\n'
  + 'call `goal` with {"action":"clear"}.\n'
  + '</steering>'

const errorText = (tool: string, agent: string, allowlist: readonly string[]): string =>
  'Goal required before other tools. Agent \'' + agent + '\' enforces goal-first. Call the `goal` tool with\n'
  + '{"action":"set","text":"<what this turn will accomplish>"} before \'' + tool + '\'. Read-only tools\n'
  + '(' + allowlist.join(', ') + ') remain available. To finish without work, set a one-line\n'
  + 'goal, then clear it.'

/**
Selection of agents the gate enforces. Config is authoritative: an agent leaves
enforcement only through `optOut` or an explicit, resolved `deny` of `goal`.
Unknown ids and unresolvable permissions are reported as `unknown` but still
enforced — a runtime resolution gap must not silently disable the gate.
*/
const selectEnforced = (
  candidates: Iterable<string>,
  isKnown: (id: string) => boolean,
  isGoalDenied: (id: string) => boolean,
  optOut: readonly string[],
): { enforced: string[], unknown: string[], denied: string[] } => {
  const enforced: string[] = []
  const unknown: string[] = []
  const denied: string[] = []
  for (const id of candidates) {
    if (optOut.includes(id)) continue
    if (isGoalDenied(id)) {
      denied.push(id)
      continue
    }
    if (!isKnown(id)) unknown.push(id)
    enforced.push(id)
  }
  return { enforced, unknown, denied }
}

/**
One concise activation line so enforcement is verifiable in the harness log.
*/
const enforcementLogLine = (enforced: readonly string[]): string =>
  enforced.length === 0
    ? '[goal-continuation] enforcement disabled'
    : '[goal-continuation] enforced agents: ' + [...enforced].sort((a, b) => a.localeCompare(b)).join(', ')

const goalInput: JsonSchema.JsonSchema = {
  type: 'object',
  properties: {
    action: {
      type: 'string',
      enum: ['set', 'clear'],
      description: '\'set\' declares or replaces the goal; \'clear\' removes it.',
    },
    text: { type: 'string', description: 'The turn\'s goal; required for action \'set\'.' },
  },
  required: ['action'],
}

const plugin: Plugin = {
  id: 'opencode.goal-continuation',
  effect: context => Effect.gen(function* () {
    const config: GoalEnforcementConfig = harnessConfig.plugins['goal-continuation']
    // Enforcement adds a separate cap; the idle loop uses MAX_NUDGES only.
    const maxSteeringRepeats = Math.max(0, Math.floor(config.maxSteeringRepeats))
    const allowlist = config.readOnlyAllowlist

    // Write-through cache of the persisted gate state; hydrated at load so a
    // hot reload restores the pre-reload state instead of assuming unarmed.
    const gate = new Map<string, GateState>()

    const isReadOnly = (tool: string): boolean =>
      allowlist.some(pattern => pattern.endsWith('*') ? tool.startsWith(pattern.slice(0, -1)) : tool === pattern)

    const listed = yield* context.agent.list().pipe(
      Effect.orElseSucceed(() => ({ data: [] as ReadonlyArray<Agent.Info> })),
    )
    const known = new Map<string, Agent.Info>()
    for (const info of listed.data) known.set(info.id as unknown as string, info)

    // True only when the last rule matching the `goal` action (tool name) and a
    // `*` resource (pattern) is a deny; false when the agent is unknown, its
    // permissions are unresolvable, or the last match allows. Last match wins,
    // mirroring Permission.resolve. Config is authoritative: only an explicit,
    // resolved deny removes a configured agent from enforcement.
    const isGoalDenied = (id: string): boolean => {
      const info = known.get(id)
      if (info === undefined) return false
      const permissions = info.permissions
      if (!Array.isArray(permissions)) return false
      let verdict: 'allow' | 'deny' | 'ask' | undefined
      for (const entry of permissions) {
        if (isGlobMatch(GOAL_TOOL, entry.action) && isGlobMatch('*', entry.resource)) verdict = entry.effect
      }
      return verdict === 'deny'
    }

    // Configured agents are always candidates; `enforceAll` adds every listed
    // agent on top. A resolution gap warns (naming the agent) instead of dropping.
    const candidates = new Set<string>(config.agents)
    if (config.enforceAll) for (const id of known.keys()) candidates.add(id)
    const selection = selectEnforced(candidates, id => known.has(id), isGoalDenied, config.optOut)
    for (const id of selection.denied) {
      yield* Effect.logWarning('[goal-continuation] agent \'' + id + '\' denies the goal tool; not enforced')
    }
    for (const id of selection.unknown) {
      yield* Effect.logWarning('[goal-continuation] agent \'' + id + '\' not in agent list; enforcing from config')
    }
    yield* Effect.logInfo(enforcementLogLine(selection.enforced))
    const enforced = new Set(selection.enforced)

    const isInToolScope = (agent: string): boolean =>
      ALLOWED_ORCHESTRATORS.has(agent) || enforced.has(agent)

    const readGoal = (sessionID: string): Effect.Effect<GoalRecord | undefined> =>
      Effect.map(context.storage.get(goalKey(sessionID)), (value) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return
        const record = value as { text?: unknown, nudges?: unknown }
        return typeof record.text !== 'string' || typeof record.nudges !== 'number' ? undefined : { text: record.text, nudges: record.nudges }
      })

    const GATE_PREFIX = 'goal-gate/'
    const gateKey = (sessionID: string): string => GATE_PREFIX + sessionID

    // Shape-validate like readGoal; undefined unless all three fields type-check.
    const parseGate = (value: unknown): GateState | undefined => {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return
      const record = value as { armed?: unknown, goalSet?: unknown, steeringSent?: unknown }
      return typeof record.armed !== 'boolean' || typeof record.goalSet !== 'boolean' || typeof record.steeringSent !== 'number'
        ? undefined
        : { armed: record.armed, goalSet: record.goalSet, steeringSent: record.steeringSent }
    }

    // The cache is the single in-process source of truth; storage is only read on
    // a cache miss (a session first touched after the load scan).
    const readGate = (sessionID: string): Effect.Effect<GateState | undefined> =>
      Effect.gen(function* () {
        const cached = gate.get(sessionID)
        if (cached !== undefined) return cached
        const value = yield* context.storage.get(gateKey(sessionID))
        const state = parseGate(value)
        if (state !== undefined) gate.set(sessionID, state)
        return state
      })

    // Commit in-process first (no yield before the set) so concurrent fibers
    // cannot interleave a read-modify-write; the awaited persist follows.
    const writeGate = (sessionID: string, state: GateState): Effect.Effect<void> =>
      Effect.gen(function* () {
        gate.set(sessionID, state)
        yield* context.storage.set(gateKey(sessionID), { ...state })
      })

    // Claim before send: increment and persist, then send. A failed send must not
    // terminate the idle consumer, so the send is wrapped to swallow errors.
    const nudge = (sessionID: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const record = yield* readGoal(sessionID)
        if (record === undefined || !(record.nudges < MAX_NUDGES)) return
        yield* context.storage.set(goalKey(sessionID), { text: record.text, nudges: record.nudges + 1 })
        yield* context.session.synthetic({
          sessionID: sessionID as Session.ID,
          text: nudgeText(record.text),
          resume: true,
        }).pipe(Effect.ignore)
      })

    const applyClear = (sessionID: string): Effect.Effect<{ content: string }> =>
      Effect.gen(function* () {
        yield* context.storage.remove(goalKey(sessionID))
        // Disarm only if a goal was set this turn; otherwise the gate stays
        // armed so a bare clear cannot bypass enforcement.
        const state = yield* readGate(sessionID)
        if (state?.goalSet === true) {
          state.armed = false
          yield* writeGate(sessionID, state)
        }
        return { content: 'ok' }
      })

    const applySet = (sessionID: string, text: string): Effect.Effect<{ content: string }> =>
      Effect.gen(function* () {
        const prior = yield* readGoal(sessionID)
        const nudges = prior !== undefined && prior.text === text ? prior.nudges : 0
        yield* context.storage.set(goalKey(sessionID), { text, nudges })

        const state = (yield* readGate(sessionID)) ?? { armed: false, goalSet: false, steeringSent: 0 }
        state.armed = false
        state.goalSet = true
        yield* writeGate(sessionID, state)
        return { content: 'ok' }
      })

    yield* context.tool.transform((editor) => {
      editor.add({
        name: GOAL_TOOL,
        description: 'Declare or clear this session\'s continuation goal. Call before other tools when goal-first enforcement is active.',
        input: goalInput,
        options: { codemode: false },
        execute: (input, toolContext) => Effect.gen(function* () {
          const arguments_ = input as { action?: unknown, text?: unknown }
          const agent = toolContext.agent as unknown as string
          if (!isInToolScope(agent)) {
            return yield* Effect.fail(new Tool.Error({
              message: 'The goal tool is not available to agent \'' + agent + '\'.',
            }))
          }
          const sessionID = toolContext.sessionID as unknown as string

          if (arguments_.action === 'clear') return yield* applyClear(sessionID)

          if (arguments_.action !== 'set') {
            return yield* Effect.fail(new Tool.Error({
              message: 'goal action must be \'set\' or \'clear\'; got \'' + String(arguments_.action) + '\'.',
            }))
          }

          const text = typeof arguments_.text === 'string' ? arguments_.text.trim() : ''
          return text.length === 0 ? (yield* Effect.fail(new Tool.Error({ message: 'goal set requires a non-empty "text".' }))) : (yield* applySet(sessionID, text))
        }),
      })
    })

    yield* context.session.hook('prompt', event => Effect.gen(function* () {
      yield* writeGate(event.sessionID as unknown as string, { armed: true, goalSet: false, steeringSent: 0 })
    }))

    const parentCache = new Map<string, string | undefined>()
    const parentOf = (sessionID: string): Effect.Effect<string | undefined> =>
      Effect.gen(function* () {
        if (parentCache.has(sessionID)) return parentCache.get(sessionID)
        const session = yield* context.session.get({ sessionID: sessionID as Session.ID }).pipe(
          Effect.orElseSucceed(() => {}),
        )
        const parent = session === undefined ? undefined : (session as { parentID?: unknown }).parentID
        const resolved = typeof parent === 'string' && parent.length > 0 ? parent : undefined
        parentCache.set(sessionID, resolved)
        return resolved
      })

    yield* context.tool.hook('execute.before', event => Effect.gen(function* () {
      const agent = event.agent as unknown as string
      if (!enforced.has(agent)) return

      // Subagent children are exempt; an unresolvable session fails open.
      const sessionID = event.sessionID as unknown as string
      if ((yield* parentOf(sessionID)) !== undefined) return

      let entry = yield* readGate(sessionID)
      if (entry === undefined) {
        entry = { armed: true, goalSet: false, steeringSent: 0 }
        yield* writeGate(sessionID, entry)
      }
      if (!entry.armed || (event.tool === GOAL_TOOL) || isReadOnly(event.tool)) return

      const state = entry
      if (state.steeringSent < maxSteeringRepeats) {
        yield* context.session.synthetic({
          sessionID: event.sessionID,
          text: steeringText(event.tool),
          delivery: 'steer',
          resume: true,
        }).pipe(
          Effect.tap(() => Effect.sync(() => { state.steeringSent += 1 })),
          Effect.tap(() => writeGate(sessionID, state)),
          Effect.ignore,
        )
      }

      return yield* Effect.fail(new Tool.Error({ message: errorText(event.tool, agent, allowlist) }))
    }))

    // Hot-reload safety: the closure is rebuilt with an empty cache, so hydrate
    // the persisted gate state before any hook can observe it. This keeps a
    // disarmed session disarmed (no forced re-declaration) and preserves
    // `steeringSent` across the reload.
    yield* Effect.gen(function* () {
      let after: string | undefined
      for (;;) {
        const page = yield* context.storage.scan(
          after === undefined ? { prefix: GATE_PREFIX } : { prefix: GATE_PREFIX, after },
        )
        for (const record of page.entries) {
          const state = parseGate(record.value)
          if (state !== undefined) gate.set(record.key.slice(GATE_PREFIX.length), state)
        }
        if (page.next === undefined) break
        after = page.next
      }
    })

    // One-time replay covers the restart gap: `session.idle` is ephemeral and is
    // not re-emitted for an already-idle session.
    yield* Effect.gen(function* () {
      let after: string | undefined
      for (;;) {
        const page = yield* context.storage.scan(
          after === undefined ? { prefix: GOAL_PREFIX } : { prefix: GOAL_PREFIX, after },
        )
        for (const record of page.entries) {
          const sessionID = record.key.slice(GOAL_PREFIX.length)
          // Upgrade gap: an open goal with no gate record (pre-persistence
          // upgrade) hydrates disarmed, matching the disarm-on-set rule, so the
          // upgrade does not fire one false enforcement burst. A persisted gate
          // record, if any, is authoritative and already cached by the scan above.
          if (!gate.has(sessionID)) {
            gate.set(sessionID, { armed: false, goalSet: true, steeringSent: 0 })
          }
          yield* nudge(sessionID)
        }
        if (page.next === undefined) break
        after = page.next
      }
    })

    yield* context.event.subscribe().pipe(
      Stream.filter(isIdle),
      Stream.runForEach(event => nudge(event.data.sessionID)),
      Effect.forkScoped,
    )
  }),
}

export default plugin
