import type { QualityGatesConfig } from '../types/quality-gate'
import { harnessConfig } from '../config/harness.config'

const DEFAULT_DEBOUNCE_MS = 300

/**
 * Reads the 'quality-gate-enforcer' section from
 * .opencode/plugins/config/harness.config.ts (modular eslint-style config).
 */
export function loadQualityGates(): QualityGatesConfig {
  const section = harnessConfig.plugins['quality-gate-enforcer']

  if (!section?.gates || section.gates.length < 7) {
    throw new Error(
      `quality-gate-enforcer: expected >=7 gates, got ${section?.gates?.length ?? 0}. Fix source, not config.`,
    )
  }

  return {
    gates: section.gates,
    debounceMs: section.debounceMs ?? DEFAULT_DEBOUNCE_MS,
  }
}
