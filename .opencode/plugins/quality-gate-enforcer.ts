/**
 * quality-gate-enforcer — OpenCode v2 Effect plugin.
 *
 * Gate state lives in `ctx.storage` (per session) and each hook run reports its
 * transitions in one synthetic append. Correlation lives in `metadata`, never in
 * a message id: `SessionMessage.ID` requires a "msg_" prefix and the runtime
 * generates the id. Hooks register through `ctx.tool.hook`, and gate commands run
 * via Bun's `$` (V2 exposes no shell-exec API).
 */
import { Effect } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import { $ } from 'bun'
import { loadQualityGates } from './helpers/gate-config'
import { runGate } from './helpers/gate-runner'
import type { Shell } from './helpers/gate-runner'
import { isGlobMatch } from './helpers/glob-match'
import { formatGateBatchResults } from './helpers/gate-formatter'
import { readFilePath, relativeTo } from './helpers/tool-input'
import type { GateConfig, GateResult, GateRunOutcome } from './types/quality-gate'

const findMatchingGates = (gates: GateConfig[], filePath: string): GateConfig[] =>
  gates.filter(gate => gate.patterns.some(pattern => isGlobMatch(pattern, filePath)))

const TARGETED_TOOLS = new Set(['edit', 'write'])

const TAG = '[quality-gate-enforcer] '

type SessionID = Parameters<Context['session']['synthetic']>[0]['sessionID']

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

        const transitionSummary = outcomes
          .map(outcome => `${outcome.gate.name}: ${outcome.previousStatus} → ${outcome.newStatus}`)
          .join(', ')
        const appended = yield* Effect.result(context.session.synthetic({
          sessionID,
          text: formatGateBatchResults(outcomes, isPreChange),
          description: `Quality gate: ${transitionSummary}`,
          metadata: {
            quality_gate: outcomes.map(outcome => outcome.gate.name).join(','),
            transition: outcomes.map(outcome => `${outcome.previousStatus}->${outcome.newStatus}`).join(','),
          },
        }))
        if (appended._tag === 'Failure') {
          yield* Effect.logWarning(TAG + 'synthetic append failed', { error: String(appended.failure) })
        }
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
