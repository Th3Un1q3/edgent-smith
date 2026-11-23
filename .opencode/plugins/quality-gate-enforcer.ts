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
import { loadQualityGates } from './gates/loader'
import { runGate } from './gates/run'
import type { Shell } from './gates/run'
import { isGlobMatch } from './helpers/runtime/glob-match'
import { namespacedStore } from './helpers/runtime/namespaced-store'
import { appendSynthetic } from './helpers/session/synthetic-append'
import { formatGateBatchResults } from './gates/format'
import { readFilePath, relativeTo } from './helpers/runtime/tool-input'
import type { GateConfig, GateResult, GateRunOutcome } from './types/quality-gate'

const findMatchingGates = (gates: GateConfig[], filePath: string): GateConfig[] =>
  gates.filter(gate => gate.patterns.some(pattern => isGlobMatch(pattern, filePath)))

const TARGETED_TOOLS = new Set(['edit', 'write'])

const statusOf = (exitCode: number): GateResult => exitCode === 0 ? 'pass' : 'fail'

const TAG = '[quality-gate-enforcer] '

type SessionID = Parameters<Context['session']['synthetic']>[0]['sessionID']

const GATES_PREFIX = 'gates/'

const isStatusRecord = (value: unknown): value is Record<string, GateResult> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const decodeStatuses = (value: unknown): Record<string, GateResult> =>
  isStatusRecord(value) ? value : {}

const isPreChangeSkip = (isPreChange: boolean, previousStatus: GateResult): boolean =>
  isPreChange && previousStatus !== 'unknown'

const statusOrUnknown = (statuses: Record<string, GateResult>, gate: GateConfig): GateResult =>
  statuses[gate.name] ?? 'unknown'

const plugin: Plugin = {
  id: 'opencode.quality-gate-enforcer',
  effect: context => Effect.gen(function* () {
    const { gates } = loadQualityGates()
    const shell = $ as unknown as Shell
    const gateStore = namespacedStore(context.storage, GATES_PREFIX, decodeStatuses)

    const readStatuses = (sessionID: string): Effect.Effect<Record<string, GateResult>> =>
      gateStore.read(sessionID)

    // Runs one gate and reports its status plus the transitions it caused (none
    // when unchanged). Returns undefined when the pre-change pass skips a gate
    // whose status is already known.
    const evaluateGate = (gate: GateConfig, previousStatus: GateResult, isPreChange: boolean) =>
      Effect.gen(function* () {
        if (isPreChangeSkip(isPreChange, previousStatus)) return
        const result = yield* Effect.promise(() => runGate(gate, shell))
        const newStatus = statusOf(result.exitCode)
        const outcomes: GateRunOutcome[] = newStatus === previousStatus
          ? []
          : [{ gate, previousStatus, newStatus, result }]
        return { newStatus, outcomes }
      })

    const applyGateEvaluations = (
      matched: GateConfig[],
      statuses: Record<string, GateResult>,
      isPreChange: boolean,
    ): Effect.Effect<GateRunOutcome[]> =>
      Effect.gen(function* () {
        const outcomes: GateRunOutcome[] = []

        for (const gate of matched) {
          const evaluated = yield* evaluateGate(gate, statusOrUnknown(statuses, gate), isPreChange)
          if (evaluated === undefined) continue
          statuses[gate.name] = evaluated.newStatus
          outcomes.push(...evaluated.outcomes)
        }

        return outcomes
      })

    const appendOutcomeSummary = (sessionID: SessionID, outcomes: GateRunOutcome[], isPreChange: boolean) =>
      Effect.gen(function* () {
        const transitionSummary = outcomes
          .map(outcome => `${outcome.gate.name}: ${outcome.previousStatus} → ${outcome.newStatus}`)
          .join(', ')
        yield* appendSynthetic(
          context.session.synthetic({
            sessionID,
            text: formatGateBatchResults(outcomes, isPreChange),
            description: `Quality gate: ${transitionSummary}`,
            metadata: {
              quality_gate: outcomes.map(outcome => outcome.gate.name).join(','),
              transition: outcomes.map(outcome => `${outcome.previousStatus}->${outcome.newStatus}`).join(','),
            },
          }),
          { _tag: 'log', tag: TAG },
        )
      })

    const runMatched = (sessionID: SessionID, filePath: string, isPreChange: boolean) =>
      Effect.gen(function* () {
        const matched = findMatchingGates(gates, filePath)
        if (matched.length === 0) return

        const statuses = yield* readStatuses(sessionID)
        const outcomes = yield* applyGateEvaluations(matched, statuses, isPreChange)

        yield* gateStore.write(sessionID, statuses)
        if (outcomes.length === 0) return

        yield* appendOutcomeSummary(sessionID, outcomes, isPreChange)
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
