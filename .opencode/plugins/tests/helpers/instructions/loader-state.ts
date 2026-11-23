import { vi } from 'vitest'

export const serviceClient = { getClient: vi.fn() }

export const carrierMock = {
  publish: vi.fn<typeof import('@plugins/instructions/carrier').publishInstructionSet>(),
  resolve: vi.fn<typeof import('@plugins/instructions/carrier').resolveInjectionCarrier>(),
  actual: undefined as unknown as typeof import('@plugins/instructions/carrier').publishInstructionSet,
  resolveActual: undefined as unknown as typeof import('@plugins/instructions/carrier').resolveInjectionCarrier,
}
