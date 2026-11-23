import type { InjectionCarrier } from './carrier-contract'
import { warn } from './carrier-warnings'

const rejectedFlagValues = new Set<string>()

const CARRIER_BY_VALUE = new Map<string, InjectionCarrier>([
  ['', 'synthetic'],
  ['synthetic', 'synthetic'],
  ['native', 'native'],
])

const rejectCarrier = (value: string, agent: string): InjectionCarrier => {
  if (!rejectedFlagValues.has(value)) {
    rejectedFlagValues.add(value)
    warn(`unknown INSTRUCTION_INJECTION value "${value}" for agent ${agent}; using synthetic`)
  }

  return 'synthetic'
}

export const resolveInjectionCarrier = (
  environment: Record<string, string | undefined>,
  agent: string,
): InjectionCarrier => {
  const value = environment.INSTRUCTION_INJECTION ?? ''
  const carrier = CARRIER_BY_VALUE.get(value)
  return carrier === undefined ? rejectCarrier(value, agent) : carrier
}
