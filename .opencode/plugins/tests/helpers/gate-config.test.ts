import type { GateConfig } from '@plugins/types/quality-gate'

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mutable stand-in for the harness config. `null` means "use the real config",
// so the happy-path test exercises the live wiring end-to-end while the
// fallback tests swap in a section-less config.
const configOverride = vi.hoisted(() => ({
  value: null as { plugins: Record<string, { gates?: GateConfig[], debounceMs?: number }> } | null,
}))

vi.mock('@plugins/config/harness.config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/config/harness.config')>()

  return {
    get harnessConfig() {
      return (configOverride.value ?? actual.harnessConfig) as typeof actual.harnessConfig
    },
  }
})

import { harnessConfig } from '@plugins/config/harness.config'

import { loadQualityGates } from '@plugins/helpers/gate-config'

describe('loadQualityGates()', () => {
  beforeEach(() => {
    configOverride.value = null
  })

  it('returns every gate declared in the live harness config', () => {
    const liveGates = harnessConfig.plugins['quality-gate-enforcer'].gates

    const { gates } = loadQualityGates()

    // Generic over the live list: passes for ANY gates configured in
    // harness.config.ts, so editing the gate list does not break this test.
    expect(gates.length).toBeGreaterThan(0)
    expect(gates).toEqual(liveGates.map(() => ({
      name: expect.any(String),
      patterns: expect.arrayContaining([expect.any(String)]),
      commands: expect.arrayContaining([expect.any(String)]),
    })))
  })

  describe('when the harness config has no quality-gate-enforcer section', () => {
    beforeEach(() => {
      configOverride.value = { plugins: {} }
    })

    it('returns no gates', () => {
      expect(loadQualityGates().gates).toEqual([])
    })

    it('falls back to the default 300ms debounce', () => {
      expect(loadQualityGates().debounceMs).toBe(300)
    })
  })
})
