import { describe, expect, it } from 'vitest'

import { formatGateBatchResults, formatGateFailure, formatGateSuccess } from '@plugins/helpers/gate-formatter'

import type { CommandResult } from '@plugins/helpers/gate-runner'

import type { GateConfig, GateRunOutcome } from '@plugins/types/quality-gate'

describe('gate-formatter', () => {
  it('formats success with command and without command', () => {
    expect(formatGateSuccess('lint', 'just lint')).toBe(
      '<steering priority="info" reason="file change triggered quality gate run" type="quality-gate" result="pass" gate-id="lint">Quality gate \'lint\' passed — `just lint` completed (exit 0)</steering>',
    )
    expect(formatGateSuccess('lint', '')).toBe(
      '<steering priority="info" reason="file change triggered quality gate run" type="quality-gate" result="pass" gate-id="lint">Quality gate \'lint\' passed — no commands to run</steering>',
    )
  })

  it('formats failure with stdout+stderr, stdout-only, and no output', () => {
    const both: CommandResult = { exitCode: 1, stdout: 'stdout line', stderr: 'stderr line' }

    expect(formatGateFailure('lint', 'just lint', both)).toBe(
      '<steering priority="warning" reason="file change triggered quality gate run" type="quality-gate" result="fail" gate-id="lint">Quality gate \'lint\' failed — `just lint` exited with code 1:\nstdout line\nstderr line</steering>',
    )

    const stdoutOnly: CommandResult = { exitCode: 2, stdout: 'only stdout', stderr: '' }

    expect(formatGateFailure('test', 'just test', stdoutOnly)).toBe(
      '<steering priority="warning" reason="file change triggered quality gate run" type="quality-gate" result="fail" gate-id="test">Quality gate \'test\' failed — `just test` exited with code 2:\nonly stdout</steering>',
    )

    const noOutput: CommandResult = { exitCode: 0, stdout: '', stderr: '' }

    expect(formatGateFailure('test', 'just test', noOutput)).toBe(
      '<steering priority="warning" reason="file change triggered quality gate run" type="quality-gate" result="fail" gate-id="test">Quality gate \'test\' failed — `just test` exited with code 0</steering>',
    )
  })
})

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

    expect(result).toContain('Pre-change Quality gate results')
    expect(result).toContain('reason="quality gate check before file change"')
  })

  it('uses correct default prefix and reason (kills string mutants)', () => {
    const result = formatGateBatchResults([passOutcome(lintGate)])

    expect(result).toContain('\nQuality gate results')
    expect(result).toContain('reason="quiet period ended; ran dirty quality gates"')
  })
})
