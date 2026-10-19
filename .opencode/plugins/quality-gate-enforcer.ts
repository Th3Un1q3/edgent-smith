/**
 * quality-gate-enforcer — OpenCode v2 Effect plugin (migrated).
 *
 * Reworked for V2: gate state lives in `ctx.storage` (per session), reporting
 * uses `ctx.session.prompt({ resume: false })`, hooks register through
 * `ctx.tool.hook`, and gate commands run via Bun's `$` (imported directly; V2
 * exposes no shell-exec API).
 */
import { Effect } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import { $ } from 'bun'
import { loadQualityGates } from './helpers/gate-config'
import { runGate } from './helpers/gate-runner'
import type { Shell } from './helpers/gate-runner'
import { isGlobMatch } from './helpers/glob-match'
import { formatGateBatchResults } from './helpers/gate-formatter'
import type { GateConfig, GateResult, GateRunOutcome } from './types/quality-gate'

// V2 tool inputs use `path` (edit/write); accept `filePath` too.
const readFilePath = (input: unknown): string | undefined => {
  const arguments_ = input as { path?: unknown, filePath?: unknown } | undefined
  const candidate = arguments_?.path ?? arguments_?.filePath
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : undefined
}

const findMatchingGates = (gates: GateConfig[], filePath: string): GateConfig[] =>
  gates.filter(gate => gate.patterns.some(pattern => isGlobMatch(pattern, filePath)))

const TARGETED_TOOLS = new Set(['edit', 'write'])

// Tool inputs carry absolute paths; gate patterns are workspace-relative.
const relativeTo = (directory: string, filePath: string): string => {
  const prefix = directory.endsWith('/') ? directory : directory + '/'
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}

type SessionID = Parameters<Context['session']['prompt']>[0]['sessionID']

const gatesKey = (sessionID: string): string => 'gates/' + sessionID

const plugin: Plugin = {
  id: 'opencode.quality-gate-enforcer',
  effect: context => Effect.gen(function* () {
    const { gates } = loadQualityGates()
    const shell = $ as unknown as Shell

    const readStatuses = (sessionID: string): Effect.Effect<Record<string, GateResult>> =>
      Effect.map(context.storage.get(gatesKey(sessionID)), value => (value as Record<string, GateResult> | undefined) ?? {})

    // Runs one gate and reports whether its status changed. Returns undefined when
    // the pre-change pass skips a gate whose status is already known.
    const evaluateGate = (gate: GateConfig, previousStatus: GateResult, isPreChange: boolean) =>
      Effect.gen(function* () {
        if (isPreChange && previousStatus !== 'unknown') return
        const result = yield* Effect.promise(() => runGate(gate, shell))
        const newStatus: GateResult = result.exitCode === 0 ? 'pass' : 'fail'
        const outcome: GateRunOutcome | undefined = newStatus === previousStatus
          ? undefined
          : { gate, previousStatus, newStatus, result }
        return { newStatus, outcome }
      })

    const runMatched = (sessionID: SessionID, filePath: string, isPreChange: boolean) =>
      Effect.gen(function* () {
        const matched = findMatchingGates(gates, filePath)
        if (matched.length === 0) return

        const statuses = yield* readStatuses(sessionID)
        const outcomes: GateRunOutcome[] = []

        for (const gate of matched) {
          const evaluated = yield* evaluateGate(gate, statuses[gate.name] ?? 'unknown', isPreChange)
          if (evaluated === undefined) continue
          statuses[gate.name] = evaluated.newStatus
          if (evaluated.outcome) outcomes.push(evaluated.outcome)
        }

        yield* context.storage.set(gatesKey(sessionID), statuses)
        if (outcomes.length === 0) return
        yield* context.session.prompt({ sessionID, text: formatGateBatchResults(outcomes, isPreChange), resume: false })
      })

    yield* context.tool.hook('execute.before', event => Effect.gen(function* () {
      if (!TARGETED_TOOLS.has(event.tool)) return
      const filePath = readFilePath(event.input)
      if (filePath === undefined) return
      yield* runMatched(event.sessionID, relativeTo(context.location.directory, filePath), true)
    }).pipe(Effect.orDie))

    yield* context.tool.hook('execute.after', event => Effect.gen(function* () {
      if (!TARGETED_TOOLS.has(event.tool)) return
      const filePath = readFilePath(event.input)
      if (filePath === undefined) return
      yield* runMatched(event.sessionID, relativeTo(context.location.directory, filePath), false)
    }).pipe(Effect.orDie))
  }),
}

export default plugin
