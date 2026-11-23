import type { CommandResult } from './run'
import { buildSteeringMessage } from '../helpers/session/steering-message'
import type { GateRunOutcome } from '../types/quality-gate'

const combineCommandOutput = (result: CommandResult): string =>
  result.stdout ? result.stdout + (result.stderr ? `\n${result.stderr}` : '') : result.stderr

const CHECK_MARK = { pass: '✓', fail: '✗', unknown: '✗' } as const

const failureOutput = (result: CommandResult): string => {
  const output = combineCommandOutput(result)
  return output ? `:\n${output}` : ''
}

const formatOutcomeLine = (outcome: GateRunOutcome): string => {
  const { gate, previousStatus, newStatus, result: commandResult } = outcome
  const command = gate.commands[0] ?? ''
  const check = CHECK_MARK[newStatus]

  const line = `${check} ${gate.name}: ${previousStatus} → ${newStatus} — \`${command}\` (exit ${commandResult.exitCode})`

  return newStatus === 'fail' ? line + failureOutput(commandResult) : line
}

const BATCH_STATUS = {
  ok: { priority: 'info', result: 'pass' },
  fail: { priority: 'warning', result: 'fail' },
} as const

const batchContext = (isPreChange: boolean | undefined): { prefix: string, reason: string } =>
  isPreChange
    ? { prefix: 'Pre-change ', reason: 'pre-change quality check' }
    : { prefix: '', reason: 'ran quality checks on files changed since last check' }

export function formatGateBatchResults(outcomes: GateRunOutcome[], isPreChange?: boolean): string {
  if (outcomes.length === 0) return ''

  const passed = outcomes.filter(o => o.newStatus === 'pass').length
  const failed = outcomes.length - passed
  const { priority, result } = failed > 0 ? BATCH_STATUS.fail : BATCH_STATUS.ok
  const { prefix, reason } = batchContext(isPreChange)

  const lines = outcomes.map(outcome => formatOutcomeLine(outcome))
  const body = [`${prefix}Quality gate transitions (${passed} now passing, ${failed} now failing):`, ...lines].join('\n')

  return buildSteeringMessage({ priority, reason, type: 'quality-gate', result }, body)
}
