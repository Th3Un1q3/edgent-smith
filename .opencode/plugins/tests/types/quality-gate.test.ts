import { describe, expectTypeOf, it } from 'vitest'

import type { GateConfig, GateKVState, GateResult, GateRunOutcome } from '@plugins/types/quality-gate'

import type { CommandResult } from '@plugins/helpers/gate-runner'

describe('GateResult', () => {
  it('is a union of three string literals', () => {
    expectTypeOf<GateResult>().toEqualTypeOf<'unknown' | 'pass' | 'fail'>()
  })

  it('does not accept arbitrary strings', () => {
    expectTypeOf<GateResult>().not.toEqualTypeOf<'running'>()

    // @ts-expect-error — 'running' is not a valid GateResult
    const _invalid: GateResult = 'running'
  })
})

describe('GateKVState', () => {
  it('has boolean dirty and GateResult status', () => {
    expectTypeOf<GateKVState>().toHaveProperty('dirty')
    expectTypeOf<GateKVState['dirty']>().toBeBoolean()
    expectTypeOf<GateKVState['status']>().toEqualTypeOf<GateResult>()
  })

  it('exactly matches its declared shape', () => {
    expectTypeOf<GateKVState>().toEqualTypeOf<{ dirty: boolean, status: GateResult }>()
  })

  it('rejects extra properties', () => {
    expectTypeOf<GateKVState>().not.toHaveProperty('extra')

    // @ts-expect-error — { dirty: boolean; status: GateResult; extra: number } is not assignable
    const _invalid: GateKVState = { dirty: false, status: 'unknown', extra: 42 }
  })
})

describe('GateRunOutcome', () => {
  it('has the correct field types', () => {
    expectTypeOf<GateRunOutcome['gate']>().toEqualTypeOf<GateConfig>()
    expectTypeOf<GateRunOutcome['previousStatus']>().toEqualTypeOf<GateResult>()
    expectTypeOf<GateRunOutcome['newStatus']>().toEqualTypeOf<GateResult>()
    expectTypeOf<GateRunOutcome['result']>().toEqualTypeOf<CommandResult>()
  })

  it('exactly matches its declared shape', () => {
    expectTypeOf<GateRunOutcome>().toEqualTypeOf<{
      gate: GateConfig
      previousStatus: GateResult
      newStatus: GateResult
      result: CommandResult
    }>()
  })

  it('rejects a string where GateConfig is expected', () => {
    expectTypeOf<GateConfig>().not.toEqualTypeOf<string>()

    const _invalid: GateRunOutcome = {
      // @ts-expect-error — string is not assignable to GateConfig
      gate: 'lint',
      previousStatus: 'unknown',
      newStatus: 'pass',
      result: { exitCode: 0, stdout: '', stderr: '' },
    }
  })
})
