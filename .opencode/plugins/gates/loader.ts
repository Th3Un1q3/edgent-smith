import type { QualityGatesConfig } from '../types/quality-gate'
import { harnessConfig } from '../config/harness'

/**
 * Reads the 'quality-gate-enforcer' section from
 * .opencode/plugins/config/harness.ts (modular eslint-style config).
 *
 * Config-shape sanity check is >=5 gates (was >=7): intentional merge of
 * 3 opencode gates into 1 reduced 7->5 (2 failures before, 0 after).
 * This is NOT a quality threshold — 85/90/72 coverage/mutation thresholds
 * are unchanged.
 */
export function loadQualityGates(): QualityGatesConfig {
  return { gates: requireGates(harnessConfig.plugins['quality-gate-enforcer']) }
}

type GateSection = typeof harnessConfig.plugins['quality-gate-enforcer']

const requireGates = (section: GateSection | undefined): GateSection['gates'] => {
  const gates = section === undefined ? [] : section.gates

  if (gates.length < 5) {
    throw new Error(
      `quality-gate-enforcer: expected >=5 gates, got ${gates.length}. Fix source, not config.`,
    )
  }

  return gates
}
