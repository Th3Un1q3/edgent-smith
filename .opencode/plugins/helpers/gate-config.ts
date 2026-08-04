import type { QualityGatesConfig } from '../types/quality-gate'
import { harnessConfig } from '../config/harness.config'

const DEFAULT_DEBOUNCE_MS = 300

/**
 * Reads the 'quality-gate-enforcer' section from
 * .opencode/plugins/config/harness.config.ts (modular eslint-style config).
 */
export function loadQualityGates(): QualityGatesConfig {
  const section = harnessConfig.plugins['quality-gate-enforcer']

  return {
    gates: section?.gates ?? [],
    debounceMs: section?.debounceMs ?? DEFAULT_DEBOUNCE_MS,
  }
}
