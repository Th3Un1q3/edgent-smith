import type { CommandResult } from '../helpers/gate-runner'

export type GateResult = 'unknown' | 'pass' | 'fail'

export interface GateKVState {
  dirty: boolean
  status: GateResult
}

export interface GateConfig {
  name: string
  patterns: string[]
  commands: string[]
}

export interface GateRunOutcome {
  gate: GateConfig
  previousStatus: GateResult
  newStatus: GateResult
  result: CommandResult
}

export interface QualityGatesConfig {
  gates: GateConfig[]
  debounceMs?: number
}
