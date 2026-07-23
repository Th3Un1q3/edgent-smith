import { describe, expect, it } from 'vitest'

import { formatGateBatchResults, formatGateFailure, formatGateSuccess } from '@plugins/helpers/gate-formatter'
import type { CommandResult } from '@plugins/helpers/gate-runner'
import type { GateConfig, GateRunOutcome } from '@plugins/types/quality-gate'

describe('gate-formatter', () => {
  it('formats success as exact steering message', () => {
    expect(formatGateSuccess('lint', 'just lint')).toBe(
      '<steering priority="info" reason="file change triggered quality gate run" result="pass" gate-id="lint">Quality gate \'lint\' passed — `just lint` completed (exit 0)</steering>',
    )
  })

  it('formats success with no command', () => {
    expect(formatGateSuccess('lint', '')).toBe(
      '<steering priority="info" reason="file change triggered quality gate run" result="pass" gate-id="lint">Quality gate \'lint\' passed — no commands to run</steering>',
    )
  })

  it('formats failure with combined stdout and stderr output', () => {
    const result: CommandResult = {
      exitCode: 1,
      stdout: 'stdout line',
      stderr: 'stderr line',
    }

    expect(formatGateFailure('lint', 'just lint', result)).toBe(
      '<steering priority="warning" reason="file change triggered quality gate run" result="fail" gate-id="lint">Quality gate \'lint\' failed — `just lint` exited with code 1:\nstdout line\nstderr line</steering>',
    )
  })

  it('formats failure using stdout when stderr is empty', () => {
    const result: CommandResult = {
      exitCode: 2,
      stdout: 'only stdout',
      stderr: '',
    }

    expect(formatGateFailure('test', 'just test', result)).toBe(
      '<steering priority="warning" reason="file change triggered quality gate run" result="fail" gate-id="test">Quality gate \'test\' failed — `just test` exited with code 2:\nonly stdout</steering>',
    )
  })

  it('formats failure without output', () => {
    const result: CommandResult = {
      exitCode: 0,
      stdout: '',
      stderr: '',
    }

    expect(formatGateFailure('test', 'just test', result)).toBe(
      '<steering priority="warning" reason="file change triggered quality gate run" result="fail" gate-id="test">Quality gate \'test\' failed — `just test` exited with code 0</steering>',
    )
  })
})

describe('formatGateBatchResults', () => {
  const lintGate: GateConfig = { name: 'lint', patterns: ['**/*.ts'], commands: ['just lint'] }
  const typeGate: GateConfig = { name: 'typecheck', patterns: ['**/*.ts'], commands: ['just typecheck'] }

  it('returns info priority when all gates pass', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
      { gate: typeGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(result).toContain('info')
    expect(result).toContain('lint')
    expect(result).toContain('typecheck')
  })

  it('returns warning priority when any gate fails', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
      { gate: typeGate, previousStatus: 'unknown', newStatus: 'fail', result: { exitCode: 1, stdout: '', stderr: 'Type error' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(result).toContain('warning')
  })

  it('includes gate name and command in each result', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
      { gate: typeGate, previousStatus: 'unknown', newStatus: 'fail', result: { exitCode: 1, stdout: '', stderr: '' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(result).toContain('lint')
    expect(result).toContain('typecheck')
    expect(result).toContain('just lint')
    expect(result).toContain('just typecheck')
  })

  it('includes exit code for each gate', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
      { gate: { name: 'test', patterns: ['**/*.ts'], commands: ['just test'] }, previousStatus: 'unknown', newStatus: 'fail', result: { exitCode: 2, stdout: '', stderr: '' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(result).toContain('0')
    expect(result).toContain('2')
  })

  it('all gates passed → single summary line', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
      { gate: typeGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(result).toMatch(/2.*passed|passed.*2/i)
  })

  it('failing gate includes stderr in output', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'fail', result: { exitCode: 1, stdout: '', stderr: 'Unexpected token' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(result).toContain('Unexpected token')
  })

  it('single message string (not array)', () => {
    const outcomes: GateRunOutcome[] = [
      { gate: lintGate, previousStatus: 'unknown', newStatus: 'pass', result: { exitCode: 0, stdout: '', stderr: '' } },
    ]
    const result = formatGateBatchResults(outcomes)

    expect(typeof result).toBe('string')
  })

  it('empty outcomes returns empty string or neutral message', () => {
    const result = formatGateBatchResults([])

    expect(typeof result).toBe('string')
  })
})
