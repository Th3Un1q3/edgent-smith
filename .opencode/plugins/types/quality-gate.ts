import type { CommandResult } from '../helpers/gate-runner'

export type GateResult = 'unknown' | 'pass' | 'fail'

export interface GateConfig {
  name: string
  patterns: string[]
  commands: string[]
  /**
   * Optional hard timeout applied to EACH command. When set, `runGate` wraps the
   * command in coreutils `timeout` (so the process tree is killed) and also races
   * the shell promise against a timer (so the gate promise always settles even if
   * the shell ignores the kill). Omit for unbounded behavior.
   */
  timeoutMs?: number
}

export interface GateRunOutcome {
  gate: GateConfig
  previousStatus: GateResult
  newStatus: GateResult
  result: CommandResult
}

export interface QualityGatesConfig {
  gates: GateConfig[]
}
