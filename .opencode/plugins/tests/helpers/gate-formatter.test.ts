import { describe, expect, it } from 'vitest'

import { formatGateBatchResults } from '@plugins/helpers/gate-formatter'

import type { GateConfig, GateRunOutcome } from '@plugins/types/quality-gate'

describe('formatGateBatchResults', () => {
  const lintGate: GateConfig = { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }

  const typeGate: GateConfig = { name: 'typecheck', patterns: ['**/*.ts'], commands: ['just typecheck'] }

  const passOutcome = (gate: GateConfig): GateRunOutcome => ({ gate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } })

  const failOutcome = (gate: GateConfig, exitCode: number, stderr = ''): GateRunOutcome => ({ gate, previousStatus: 'unknown', newStatus: 'fail', result: { exitCode, stdout: '', stderr } })

  it('returns info when all pass, warning when any fail', () => {
    const allPass = formatGateBatchResults([passOutcome(lintGate), passOutcome(typeGate)])

    expect(allPass).toContain('priority="info"')
    expect(allPass).toContain('result="pass"')

    const anyFail = formatGateBatchResults([passOutcome(lintGate), failOutcome(typeGate, 1, 'Type error')])

    expect(anyFail).toContain('priority="warning"')
    expect(anyFail).toContain('result="fail"')
  })

  it('returns empty string for empty outcomes', () => {
    expect(formatGateBatchResults([])).toBe('')
  })

  it('includes gate names, commands, and checkmarks', () => {
    const result = formatGateBatchResults([passOutcome(lintGate), failOutcome(typeGate, 1)])

    expect(result).toContain('✓ lint')
    expect(result).toContain('✗ typecheck')
    expect(result).toContain('just lint')
    expect(result).toContain('just typecheck')
  })

  it('omits output section for passing gate and for failing gate with no output', () => {
    const withStdout = formatGateBatchResults([{ ...passOutcome(lintGate), result: { exitCode: 0, stdout: 'some output', stderr: '' } }])

    expect(withStdout).not.toMatch(/some output/)

    const noOutput = formatGateBatchResults([failOutcome(lintGate, 1)])

    expect(noOutput).toContain('✗ lint')
    expect(noOutput).not.toContain('(exit 1):\n')
  })

  it('uses "Pre-change" prefix and correct reason when isPreChange is true', () => {
    const result = formatGateBatchResults([passOutcome(lintGate)], true)

    expect(result).toContain('Pre-change Quality gate transitions')
    expect(result).toContain('reason="pre-change quality check"')
  })

  it('uses correct default prefix and reason (kills string mutants)', () => {
    const result = formatGateBatchResults([passOutcome(lintGate)])

    expect(result).toContain('\nQuality gate transitions')
    expect(result).toContain('reason="ran quality checks on files changed since last check"')
  })
})
