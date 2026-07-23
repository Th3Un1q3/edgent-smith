import type { GateConfig, QualityGatesConfig } from '@plugins/types/quality-gate'
import { log } from '@plugins/helpers/logger'
import type { OpencodeClient } from "@opencode-ai/sdk"

const DEFAULT_DEBOUNCE_MS = 300

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isArrayOfStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => isString(item))
}

function isValidGateConfig(value: unknown): value is GateConfig {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const gate = value as Partial<GateConfig>

  return (
    typeof gate.name === 'string' &&
    gate.name.length > 0 &&
    isArrayOfStrings(gate.patterns) &&
    gate.patterns.length > 0 &&
    isArrayOfStrings(gate.commands) &&
    gate.commands.length > 0
  )
}

export async function loadQualityGates(directory: string, client: OpencodeClient): Promise<QualityGatesConfig> {
  const fallback: QualityGatesConfig = { gates: [], debounceMs: DEFAULT_DEBOUNCE_MS }

  try {
    const file = Bun.file(`${directory}/.opencode/quality-gates.json`)
    const config = await file.json() as QualityGatesConfig

    if (!Array.isArray(config.gates) || !config.gates.every(isValidGateConfig)) {
      log(client, "warn", `Invalid quality-gates config at ${directory}/.opencode/quality-gates.json`)
      return fallback
    }

    return {
      gates: config.gates,
      debounceMs: typeof config.debounceMs === 'number' ? config.debounceMs : DEFAULT_DEBOUNCE_MS,
    }
  } catch {
    log(client, "warn", `No quality-gates config found at ${directory}/.opencode/quality-gates.json`)
    return fallback
  }
}
