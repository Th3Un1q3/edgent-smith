import { vi } from 'vitest'

import { carrierMock, serviceClient } from '@tests/helpers/instructions/loader-state'

// Registration-only module: it exports nothing, so the exported-module purity rule does not
// apply, and suites import it for these registrations before the harness loads the plugin.
vi.mock('@plugins/helpers/runtime/service-client', () => ({ getClient: serviceClient.getClient }))
vi.mock('@plugins/instructions/carrier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/instructions/carrier')>()

  carrierMock.actual = actual.publishInstructionSet
  carrierMock.resolveActual = actual.resolveInjectionCarrier
  return { ...actual, publishInstructionSet: carrierMock.publish, resolveInjectionCarrier: carrierMock.resolve }
})
