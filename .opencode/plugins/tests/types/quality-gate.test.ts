import { describe, expectTypeOf, it } from 'vitest'

import type { GateConfig, GateResult, GateRunOutcome } from '@plugins/types/quality-gate'

import type { CommandResult } from '@plugins/gates/run'

describe('GateResult', () => {
  it('is a union of three string literals', () => {
    expectTypeOf<GateResult>().toEqualTypeOf<'unknown' | 'pass' | 'fail'>()
  })

  it('does not accept arbitrary strings', () => {
    expectTypeOf<GateResult>().not.toEqualTypeOf<'running'>()

    // @ts-expect-error — 'running' is not a valid GateResult
    const invalid: GateResult = 'running'
    void invalid
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

    const invalid: GateRunOutcome = {
      // @ts-expect-error — string is not assignable to GateConfig
      gate: 'lint',
      previousStatus: 'unknown',
      newStatus: 'pass',
      result: { exitCode: 0, stdout: '', stderr: '' },
    }
    void invalid
  })
})
