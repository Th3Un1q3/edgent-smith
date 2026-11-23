import { afterEach, beforeEach, vi } from 'vitest'

import { carrierMock } from '@tests/helpers/instructions/loader-state'

import type { Harness } from '@tests/helpers/instructions/loader-harness'

export { carrierMock, serviceClient } from '@tests/helpers/instructions/loader-state'

export const installLoaderSetup = (): void => {
  const environment = { previous: undefined as string | undefined }

  beforeEach(() => {
    environment.previous = process.env.INSTRUCTION_INJECTION
    delete process.env.INSTRUCTION_INJECTION
    carrierMock.publish.mockReset()
    carrierMock.publish.mockImplementation(carrierMock.actual)
    carrierMock.resolve.mockReset()
    carrierMock.resolve.mockImplementation(carrierMock.resolveActual)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (environment.previous === undefined) delete process.env.INSTRUCTION_INJECTION
    else process.env.INSTRUCTION_INJECTION = environment.previous
  })
}

export const putKeys = (h: Harness): string[] => h.store.put.mock.calls.map(call => (call[0] as { key: string }).key)

export const logLines = (h: Harness): string[] => h.logs.map(parts => parts.map(String).join(' '))
