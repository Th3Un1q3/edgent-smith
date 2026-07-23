import { describe, expect, it } from 'vitest'

// Import the new types that should exist after the fix.
// These imports will fail at compile time until quality-gate.ts is updated.
import type { GateConfig, GateKVState, GateResult, GateRunOutcome } from '@plugins/types/quality-gate'
import type { CommandResult } from '@plugins/helpers/gate-runner'

describe('GateResult', () => {
  it('accepts all valid status values', () => {
    const values: GateResult[] = ['unknown', 'pass', 'fail']
    expect(values).toHaveLength(3)
  })
})

describe('GateKVState', () => {
  it('has the correct shape', () => {
    const state: GateKVState = { dirty: false, status: 'unknown' }
    expect(state.dirty).toBe(false)
    expect(state.status).toBe('unknown')
  })

  it('accepts dirty=true with pass status', () => {
    const state: GateKVState = { dirty: true, status: 'pass' }
    expect(state.dirty).toBe(true)
    expect(state.status).toBe('pass')
  })

  it('accepts dirty=false with fail status', () => {
    const state: GateKVState = { dirty: false, status: 'fail' }
    expect(state.dirty).toBe(false)
    expect(state.status).toBe('fail')
  })
})

describe('GateRunOutcome', () => {
  it('has gate, previousStatus, newStatus, and result fields', () => {
    const gate: GateConfig = { name: 'lint', patterns: ['*.ts'], commands: ['just lint'] }
    const result: CommandResult = { exitCode: 0, stdout: '', stderr: '' }

    const outcome: GateRunOutcome = {
      gate,
      previousStatus: 'unknown',
      newStatus: 'pass',
      result,
    }

    expect(outcome.gate.name).toBe('lint')
    expect(outcome.previousStatus).toBe('unknown')
    expect(outcome.newStatus).toBe('pass')
    expect(outcome.result.exitCode).toBe(0)
  })

  it('captures transition from fail to pass', () => {
    const gate: GateConfig = { name: 'test', patterns: ['*.ts'], commands: ['just test'] }
    const result: CommandResult = { exitCode: 0, stdout: '', stderr: '' }

    const outcome: GateRunOutcome = {
      gate,
      previousStatus: 'fail',
      newStatus: 'pass',
      result,
    }

    expect(outcome.previousStatus).toBe('fail')
    expect(outcome.newStatus).toBe('pass')
    expect(outcome.result.exitCode).toBe(0)
  })
})
