import type { QualityGatesConfig } from '../types/quality-gate'
import { harnessConfig } from '../config/harness.config'

const DEFAULT_DEBOUNCE_MS = 300

/**
 * Reads the 'quality-gate-enforcer' section from
 * .opencode/plugins/config/harness.config.ts (modular eslint-style config).
 *
 * Config-shape sanity check is >=5 gates (was >=7): intentional merge of
 * 3 opencode gates into 1 reduced 7->5 (2 failures before, 0 after).
 * This is NOT a quality threshold — 85/90/72 coverage/mutation thresholds
 * are unchanged.
 */
export function loadQualityGates(): QualityGatesConfig {
  const section = harnessConfig.plugins['quality-gate-enforcer']

  if (!section?.gates || section.gates.length < 5) {
    throw new Error(
      `quality-gate-enforcer: expected >=5 gates, got ${section?.gates?.length ?? 0}. Fix source, not config.`,
    )
  }

  return {
    gates: section.gates,
    debounceMs: section.debounceMs ?? DEFAULT_DEBOUNCE_MS,
  }
}
