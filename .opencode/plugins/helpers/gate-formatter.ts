import type { CommandResult } from './gate-runner'
import type { GateRunOutcome } from '../types/quality-gate'

const combineCommandOutput = (result: CommandResult): string =>
  result.stdout ? result.stdout + (result.stderr ? `\n${result.stderr}` : '') : result.stderr

const formatOutcomeLine = (outcome: GateRunOutcome): string => {
  const { gate, previousStatus, newStatus, result: commandResult } = outcome
  const command = gate.commands[0] ?? ''
  const check = newStatus === 'pass' ? '✓' : '✗'

  let line = `${check} ${gate.name}: ${previousStatus} → ${newStatus} — \`${command}\` (exit ${commandResult.exitCode})`

  if (newStatus === 'fail') {
    const output = combineCommandOutput(commandResult)
    if (output) {
      line += `:\n${output}`
    }
  }

  return line
}

export function formatGateFailure(
  gateName: string,
  command: string,
  result: CommandResult,
): string {
  const output = combineCommandOutput(result)
  return `<steering priority="warning" reason="file change triggered quality gate run" type="quality-gate" result="fail" gate-id="${gateName}">Quality gate '${gateName}' failed — \`${command}\` exited with code ${result.exitCode}${output ? `:\n${output}` : ''}</steering>`
}

export function formatGateBatchResults(outcomes: GateRunOutcome[], isPreChange?: boolean): string {
  if (outcomes.length === 0) return ''

  const passed = outcomes.filter(o => o.newStatus === 'pass').length
  const failed = outcomes.length - passed
  const isAnyFail = failed > 0

  const priority = isAnyFail ? 'warning' : 'info'
  const resultAttribute = isAnyFail ? 'fail' : 'pass'
  const prefix = isPreChange ? 'Pre-change ' : ''
  const reason = isPreChange ? 'pre-change quality check' : 'ran quality checks on files changed since last check'

  const lines = outcomes.map(outcome => formatOutcomeLine(outcome))

  return `<steering priority="${priority}" reason="${reason}" type="quality-gate" result="${resultAttribute}">\n${[`${prefix}Quality gate transitions (${passed} now passing, ${failed} now failing):`, ...lines].join('\n')}\n</steering>`
}
