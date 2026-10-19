/**
 * tool-limit-reminder — OpenCode v2 Effect plugin (migrated from v1; absorbs
 * `session-tracker`).
 *
 * One `effect` closure, eight parts: config + lazy per-agent budget resolver,
 * per-session counters (`Ref`s), the three-tier `execute.before` gate, the
 * `execute.after` tally, the `<task-budget>` prompt tag, the idle reset +
 * review/export pipeline, the restart-gap replay, and the Bun `$` export runner.
 *
 * Counting is one coherent source. `callsBefore` increments exactly once, in
 * `execute.before`, right after the pre-increment read that drives all three
 * tiers — it is the only gate counter. `callsCompleted` increments in
 * `execute.after` for `status === 'completed'` calls and is the problem
 * `actual`, so a call blocked here (or denied by goal-continuation) never
 * inflates the report. Thresholds come from the agent budget, not either
 * counter.
 *
 * Durable state is only what has no native home: the problem list under
 * `review/<sessionID>` in `context.storage` plus `metadata.needsReview` on the
 * session (native, durable, fork-inherited). Counters, budget cache, tag-set
 * and parent cache are in-memory and per-turn; a restart starts a new turn.
 */
import { Effect, Ref, Stream } from 'effect'
import type { Schema } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import type { Agent } from '@opencode/schema/agent'
import type { Session } from '@opencode/schema/session'
import { Tool } from '@opencode/schema/tool'
import { $ } from 'bun'
import { mkdir, writeFile } from 'node:fs/promises'

import { harnessConfig } from './config/harness.config'
import { DEFAULT_TOOL_LIMIT, resolveBudget } from './helpers/tool-limit'
import type { ProblemStatement, ToolLimitConfig } from './types/tool-limit'

const REVIEW_PREFIX = 'review/'
const REVIEW_ROOT = '/workspace/.tmp/session-review'
const NEEDS_REVIEW = 'needsReview'

/**
Byte-identical to the v1 block message: `execute.before` fails with this text.
*/
const BLOCK_TEXT = 'Error calling tools. Reason: tools are blocked. STOP YOUR WORK. DON\'T change, read, write files, execute commands in this session. Follow the instructions in the previous message to summarize your work and stop.'

const reviewSteering = (count: number, limit: number): string =>
  '<steering priority="warning" reason="tool call limit exceeded" type="instructions">\n'
  + 'STOP!\n'
  + 'You have exceeded the tool call limit for this agent. Current count: ' + count + ', Limit: ' + limit + '\n'
  + 'Your work will be exported for review when the session goes idle.\n'
  + '</steering>'

const reminderSteering = (limit: number): string =>
  '<steering priority="warning" reason="tool call limit reached" type="instructions">\n'
  + 'STOP!\n'
  + 'DO NOT CALL ANY OTHER TOOLS, DON\'T change, read, write files, execute commands in this session. You have reached the tool call limit for this agent.\n'
  + '\n'
  + 'You\'ve exhausted the task budget for this iteration. You\'ve made ' + limit + ' tool calls which is the limit.\n'
  + '\n'
  + 'Ignoring this instruction will result in progress lost.\n'
  + '\n'
  + 'Output the summary:\n'
  + '- What you have done so far\n'
  + '- What problems you encountered\n'
  + '- What worked and what did not work\n'
  + '- What is left to do\n'
  + '- What you could\'ve done if you got more time\n'
  + '</steering>'

/**
Advertised budget must equal the enforced threshold, or an agent plans for
calls the gate blocks.
*/
const budgetTag = (budget: number): string => '<task-budget tool-calls="' + budget + '" />'

/**
Dedupe identity is `source:thresholdName`, so repeated crossings of one
threshold are safe no-ops.
*/
const problemIdentity = (entry: ProblemStatement): string => entry.source + ':' + entry.thresholdName

const agentProblemStatement = (agentName: string, expectedMax: number, actual: number): ProblemStatement => ({
  source: 'agent',
  thresholdName: agentName,
  expectedMax,
  actual,
  message: `The session took ${actual} tool calls for agent '${agentName}', exceeding the agent's budget of ${expectedMax} steps. Investigate why the agent exceeded its step budget.`,
})

const renderProblemsMarkdown = (problems: readonly ProblemStatement[]): string => {
  if (problems.length === 0) return '# Reported Threshold Violations\n\n*None reported.*\n'
  const sections = problems.map(problem => `## ${problem.source}: ${problem.thresholdName}\n<!-- problem-id: ${problem.source}:${problem.thresholdName} -->\n${problem.message}`)
  return `# Reported Threshold Violations\n\n${sections.join('\n\n')}\n`
}

/**
POSIX single-quote a value so it survives being embedded in a shell command.
*/
const quoteShellArgument = (value: string): string => `'${value.replaceAll('\'', String.raw`'\''`)}'`

/**
Bun's `$` takes a template; a plain array carrying `raw` is the raw command form
(no interpolation), mirroring `gate-runner.ts`.
*/
const asTemplate = (command: string): TemplateStringsArray =>
  Object.assign([command], { raw: [command] })

const readAndBump = (map: Map<string, number>, key: string): readonly [number, Map<string, number>] => [
  map.get(key) ?? 0,
  bumpCount(map, key),
]

const bumpCount = (map: Map<string, number>, key: string): Map<string, number> => {
  const next = new Map(map)
  next.set(key, (map.get(key) ?? 0) + 1)
  return next
}

const dropKey = (map: Map<string, number>, key: string): Map<string, number> => {
  const next = new Map(map)
  next.delete(key)
  return next
}

const dropFromSet = (set: Set<string>, value: string): Set<string> => {
  const next = new Set(set)
  next.delete(value)
  return next
}

const reviewKey = (sessionID: string): string => REVIEW_PREFIX + sessionID

/**
`context.event.subscribe` is unary: it exposes the whole `OpenCodeEvent` union
and takes no event-type argument, so a specific type is selected with
`Stream.filter`, whose predicate narrows the union.
*/
type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

type IdleEvent = Extract<PluginEvent, { type: 'session.idle' | 'session.status' }>

const isIdleEvent = (event: PluginEvent): event is IdleEvent =>
  event.type === 'session.idle' || (event.type === 'session.status' && event.data.status.type === 'idle')

const isAgentSelectedEvent = (event: PluginEvent): event is Extract<PluginEvent, { type: 'session.agent.selected' }> =>
  event.type === 'session.agent.selected'

const plugin: Plugin = {
  id: 'opencode.tool-limit-reminder',
  effect: context => Effect.gen(function* () {
    // The section is authoritative; defaults fold in so a missing or partial
    // section degrades to DEFAULT_TOOL_LIMIT instead of `undefined` fields.
    const section = harnessConfig.plugins['tool-limit-reminder'] as unknown as ToolLimitConfig | undefined
    const config: ToolLimitConfig = section === undefined ? DEFAULT_TOOL_LIMIT : { ...DEFAULT_TOOL_LIMIT, ...section }
    const padding = Math.max(0, Math.floor(config.padding))
    const ignoreTools = new Set(config.ignoreTools)
    const review = config.review

    // In-memory, per-turn state. Refs keep increments atomic under parallel calls.
    const callsBefore = yield* Ref.make(new Map<string, number>())
    const callsCompleted = yield* Ref.make(new Map<string, number>())
    const budgetCache = yield* Ref.make(new Map<string, number | undefined>())
    const tagged = yield* Ref.make(new Set<string>())
    const parents = yield* Ref.make(new Map<string, string | undefined>())

    /**
    `agent.list()` is empty at registration, so it is not the budget source: the
    budget resolves on first sight of an agent id and caches `number | undefined`.
    A failed `get` or an absent/non-numeric `steps` resolves to `undefined` =
    unlimited (v1 parity).
    */
    const budgetOf = (agentID: string): Effect.Effect<number | undefined> =>
      Effect.gen(function* () {
        const cached = yield* Ref.get(budgetCache)
        if (cached.has(agentID)) return cached.get(agentID)
        const info = yield* context.agent.get({ agentID: agentID as unknown as Agent.ID }).pipe(
          Effect.map(result => result.data),
          Effect.orElseSucceed(() => {}),
        )
        const steps = info === undefined ? undefined : info.steps
        const budget = resolveBudget(agentID, typeof steps === 'number' ? steps : undefined, config.limits, config.factor)
        yield* Ref.update(budgetCache, map => new Map(map).set(agentID, budget))
        return budget
      })

    const readSession = (sessionID: string): Effect.Effect<Session.Info | undefined> =>
      context.session.get({ sessionID: sessionID as unknown as Session.ID }).pipe(
        Effect.orElseSucceed<Session.Info | undefined>(() => {}),
      )

    const readProblems = (sessionID: string): Effect.Effect<ProblemStatement[]> =>
      Effect.map(context.storage.get(reviewKey(sessionID)), (value) => {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) return []
        const problems = (value as { problems?: unknown }).problems
        return Array.isArray(problems) ? (problems as ProblemStatement[]) : []
      })

    const appendProblem = (sessionID: string, problem: ProblemStatement): Effect.Effect<void> =>
      Effect.gen(function* () {
        const existing = yield* readProblems(sessionID)
        if (existing.some(entry => problemIdentity(entry) === problemIdentity(problem))) return
        const payload = { problems: [...existing, problem] } as unknown as Schema.Json
        yield* context.storage.set(reviewKey(sessionID), payload)
      })

    /**
    `Session.Metadata` is a plain record and `update` may replace it, so the
    record is copied and one key is set or deleted — never passed `undefined`,
    which would be a type error and could wipe sibling keys.
    */
    const setNeedsReview = (sessionID: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const session = yield* readSession(sessionID)
        if (session === undefined) return
        const metadata = { ...(session.metadata as Record<string, Schema.Json> | undefined), [NEEDS_REVIEW]: true }
        yield* context.session.update({
          sessionID: sessionID as unknown as Session.ID,
          metadata: metadata as unknown as Session.Metadata,
        }).pipe(Effect.ignore)
      })

    const clearNeedsReview = (sessionID: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        const session = yield* readSession(sessionID)
        if (session === undefined) return
        const metadata = { ...(session.metadata as Record<string, Schema.Json> | undefined) }
        delete metadata[NEEDS_REVIEW]
        yield* context.session.update({
          sessionID: sessionID as unknown as Session.ID,
          metadata: metadata as unknown as Session.Metadata,
        }).pipe(Effect.ignore)
      })

    /**
    `parentID` resolves once per session (cached, like `parentOf`). Children are
    exempt from blocking and keep their own counters; an unresolvable session
    counts as top-level, so the gate fails closed rather than silently off.
    */
    const isChild = (sessionID: string): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const cached = yield* Ref.get(parents)
        if (cached.has(sessionID)) return cached.get(sessionID) !== undefined
        const session = yield* readSession(sessionID)
        const parent = session?.parentID
        const resolved = typeof parent === 'string' && parent.length > 0 ? parent : undefined
        yield* Ref.update(parents, map => new Map(map).set(sessionID, resolved))
        return resolved !== undefined
      })

    const exportSession = (sessionID: string): Effect.Effect<boolean> =>
      Effect.promise(async () => {
        const command = review.command + ' ' + quoteShellArgument(sessionID)
        const result = await $(asTemplate(command)).nothrow().quiet()
        return result.exitCode === 0
      }).pipe(Effect.orElseSucceed(() => false))

    const writeProblemsMarkdown = (sessionID: string, problems: readonly ProblemStatement[]): Effect.Effect<void> =>
      Effect.promise(async () => {
        const directory = REVIEW_ROOT + '/' + sessionID
        await mkdir(directory, { recursive: true })
        await writeFile(directory + '/problems.md', renderProblemsMarkdown(problems))
      }).pipe(
        Effect.tapError(error => Effect.logWarning('[tool-limit-reminder] failed to write problems markdown: ' + String(error))),
        Effect.orElseSucceed(() => {}),
      )

    const needsReview = (sessionID: string): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        if ((yield* readProblems(sessionID)).length > 0) return true
        const session = yield* readSession(sessionID)
        return session?.metadata?.[NEEDS_REVIEW] === true
      })

    /**
    Export once per idle, then clear both durable records. A failed export
    retains them so the next idle retries (v1 parity).
    */
    const exportReview = (sessionID: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        if (!review.export || !(yield* needsReview(sessionID))) return
        if (!(yield* exportSession(sessionID))) {
          yield* Effect.logWarning('[tool-limit-reminder] export failed for session ' + sessionID + '; review state retained')
          return
        }
        const problems = yield* readProblems(sessionID)
        if (review.writeMarkdown) yield* writeProblemsMarkdown(sessionID, problems)
        yield* context.storage.remove(reviewKey(sessionID))
        yield* clearNeedsReview(sessionID)
      })

    // Idle resets the turn: counters and the tag guard go back to zero.
    const onIdle = (sessionID: string): Effect.Effect<void> =>
      Effect.gen(function* () {
        yield* Ref.update(callsBefore, map => dropKey(map, sessionID))
        yield* Ref.update(callsCompleted, map => dropKey(map, sessionID))
        yield* Ref.update(tagged, set => dropFromSet(set, sessionID))
        yield* exportReview(sessionID)
      })

    // ── Three-tier gate ──────────────────────────────────────────────────────

    yield* context.tool.hook('execute.before', event => Effect.gen(function* () {
      if (ignoreTools.has(event.tool)) return

      const agentID = event.agent as unknown as string
      const budget = yield* budgetOf(agentID)
      if (budget === undefined) return // unlisted or stepless agent: unlimited (v1 parity)

      const sessionID = event.sessionID as unknown as string

      // Atomic read-then-increment: the pre-increment value drives all three
      // tiers and is the only gate counter.
      const current = yield* Ref.modify(callsBefore, map => readAndBump(map, sessionID))

      if (current > budget + padding) {
        if (yield* isChild(sessionID)) return // children are exempt from blocking
        yield* Effect.logWarning('[tool-limit-reminder] blocked ' + agentID + ' in session ' + sessionID + ' at ' + current + ' calls (limit ' + budget + ')')
        return yield* Effect.fail(new Tool.Error({ message: BLOCK_TEXT }))
      }

      if (current > budget) {
        // The `actual` is completed calls, so attempts never inflate the report.
        const completed = (yield* Ref.get(callsCompleted)).get(sessionID) ?? 0
        yield* setNeedsReview(sessionID)
        yield* appendProblem(sessionID, agentProblemStatement(agentID, budget, completed))
        yield* context.session.synthetic({
          sessionID: event.sessionID,
          text: reviewSteering(current + 1, budget),
          resume: false,
        }).pipe(Effect.ignore)
        return
      }

      if (current !== budget) return // below threshold: nothing special

      yield* context.session.synthetic({
        sessionID: event.sessionID,
        text: reminderSteering(budget),
        resume: false,
      }).pipe(Effect.ignore)
    }))

    // Tally of calls that actually ran: a call blocked here (or denied by
    // goal-continuation) never reaches `execute.after`.
    yield* context.tool.hook('execute.after', event => Effect.gen(function* () {
      if (ignoreTools.has(event.tool) || (event.status !== 'completed')) return
      const sessionID = event.sessionID as unknown as string
      yield* Ref.update(callsCompleted, map => bumpCount(map, sessionID))
    }))

    /**
    Budget tag: the advertised budget is the enforced threshold, so it uses the
    same lazy resolver. `SessionHooks.prompt` carries no agent, so the agent
    comes from `Session.Info.agent`; absent means skip (v1 parity).
    */
    yield* context.session.hook('prompt', event => Effect.gen(function* () {
      const sessionID = event.sessionID as unknown as string
      if ((yield* Ref.get(tagged)).has(sessionID)) return
      const session = yield* readSession(sessionID)
      const agentID = session?.agent
      if (agentID === undefined) return
      const budget = yield* budgetOf(agentID as unknown as string)
      if (budget === undefined) return
      event.prompt.text = budgetTag(budget) + '\n' + event.prompt.text
      yield* Ref.update(tagged, set => new Set(set).add(sessionID))
    }))

    // Idle drives both the reset and the export pipeline. `session.status`
    // carries the same signal; `session.idle` may not be re-emitted for a
    // session that is already idle.
    yield* context.event.subscribe().pipe(
      Stream.filter(isIdleEvent),
      Stream.runForEach(event => onIdle(event.data.sessionID as unknown as string)),
      Effect.forkScoped,
    )

    // A budget change arrives as an agent switch, not a registration:
    // `agent.transform` is a Transform, so the cache invalidates on the event.
    yield* context.event.subscribe().pipe(
      Stream.filter(isAgentSelectedEvent),
      Stream.runForEach(() => Ref.set(budgetCache, new Map<string, number | undefined>())),
      Effect.forkScoped,
    )

    // Restart gap: a session that idled while the plugin was down emits no live
    // `session.idle`, so the durable problem records replay once at registration.
    yield* Effect.gen(function* () {
      let after: string | undefined
      for (;;) {
        const page = yield* context.storage.scan(
          after === undefined ? { prefix: REVIEW_PREFIX } : { prefix: REVIEW_PREFIX, after },
        )
        for (const entry of page.entries) {
          yield* exportReview(entry.key.slice(REVIEW_PREFIX.length))
        }
        if (page.next === undefined) break
        after = page.next
      }
    })
  }),
}

export default plugin
