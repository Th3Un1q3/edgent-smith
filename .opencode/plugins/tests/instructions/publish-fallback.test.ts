import { beforeEach, describe, expect, it, vi } from 'vitest'

import '@tests/helpers/instructions/loader-mocks'

import { carrierMock, installLoaderSetup, serviceClient } from '@tests/helpers/instructions/loader-setup'

import { InstructionCarrierUnavailableError } from '@plugins/instructions/carrier'

import { InstructionContextHelper } from '@plugins/instructions/context-helper'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions/loader-harness'

installLoaderSetup()

describe('instructions-loader publish fallback', () => {
  beforeEach(() => {
    process.env.INSTRUCTION_INJECTION = 'native'
  })

  it('a rejecting publisher leaves the hook successful', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    carrierMock.publish.mockRejectedValueOnce(new InstructionCarrierUnavailableError('transport'))
    await register(h)
    await expect(h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })).resolves.toBeUndefined()

    expect(h.prompts).toHaveLength(0)
  })

  it('a publisher that reports fallback runs the synthetic arm once', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    carrierMock.publish.mockResolvedValueOnce({ outcome: 'fallback', published: [], statuses: [] })
    await register(h)
    await expect(h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })).resolves.toBeUndefined()

    expect(h.synthetics.map(message => message.text)).toEqual([expect.stringContaining('ALPHA BODY')])
  })

  it('an unclassifiable list failure skips the turn without a prompt', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    h.store.list.mockRejectedValueOnce(new Error('boom'))
    await register(h)
    await expect(h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })).resolves.toBeUndefined()

    expect(h.prompts).toHaveLength(0)
    expect(carrierMock.publish).not.toHaveBeenCalled()
  })

  it('a client without the entry method falls back', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    serviceClient.getClient.mockResolvedValue({ session: { instructions: {} } })
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.synthetics.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
    expect(h.store.put).not.toHaveBeenCalled()
  })

  const orphans = [
    ['applyTo present', 'src/**', 'applyTo: src/**'],
    ['applyTo unknown', undefined, 'applyTo: unknown'],
  ] as const

  it.each(orphans)('warns and skips a candidate with neither path nor description (%s)', async (_name, applyTo, fragment) => {
    const h = makeHarness()
    const warning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    vi.spyOn(InstructionContextHelper.prototype, 'resolveInstructions').mockResolvedValueOnce([
      { applyTo, content: 'ORPHAN BODY', idempotencyKey: 'instruction_load:orphan' },
    ])
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(warning).toHaveBeenCalledWith(expect.stringContaining(fragment))
    expect(h.store.put).not.toHaveBeenCalled()
    expect(h.prompts).toHaveLength(0)
  })
})
