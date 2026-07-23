import type { CommandResult } from '@plugins/helpers/gate-runner'
import type { GateRunOutcome } from '@plugins/types/quality-gate'

export function formatGateSuccess(gateName: string, command: string): string {
  const detail = command ? ` — \`${command}\` completed (exit 0)` : ' — no commands to run'
  return `<steering priority="info" reason="file change triggered quality gate run" result="pass" gate-id="${gateName}">Quality gate '${gateName}' passed${detail}</steering>`
}

export function formatGateFailure(
  gateName: string,
  command: string,
  result: CommandResult,
): string {
  const output = result.stdout ? result.stdout + (result.stderr ? `\n${result.stderr}` : '') : result.stderr
  return `<steering priority="warning" reason="file change triggered quality gate run" result="fail" gate-id="${gateName}">Quality gate '${gateName}' failed — \`${command}\` exited with code ${result.exitCode}${output ? `:\n${output}` : ''}</steering>`
}

export function formatGateBatchResults(outcomes: GateRunOutcome[]): string {
  if (outcomes.length === 0) return ''

  const passed = outcomes.filter((o) => o.newStatus === 'pass').length
  const failed = outcomes.length - passed
  const isAnyFail = failed > 0

  const priority = isAnyFail ? 'warning' : 'info'
  const resultAttribute = isAnyFail ? 'fail' : 'pass'

  const lines: string[] = [
    `Quality gate results (${passed} passed, ${failed} failed):`,
  ]

  for (const outcome of outcomes) {
    const { gate, previousStatus, newStatus, result: commandResult } = outcome
    const command = gate.commands[0] ?? ''
    const check = newStatus === 'pass' ? '✓' : '✗'

    let line = `${check} ${gate.name}: ${previousStatus} → ${newStatus} — \`${command}\` (exit ${commandResult.exitCode})`

    if (newStatus === 'fail') {
      const output = commandResult.stdout
        ? commandResult.stdout + (commandResult.stderr ? `\n${commandResult.stderr}` : '')
        : commandResult.stderr
      if (output) {
        line += `:\n${output}`
      }
    }

    lines.push(line)
  }

  return `<steering priority="${priority}" reason="quiet period ended; ran dirty quality gates" result="${resultAttribute}">\n${lines.join('\n')}\n</steering>`
}
