import { beforeEach, describe, expect, it, vi } from 'vitest'

import '@tests/helpers/instructions/loader-mocks'

import { carrierMock, installLoaderSetup, logLines } from '@tests/helpers/instructions/loader-setup'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions/loader-harness'

installLoaderSetup()

describe('instructions-loader carrier selection', () => {
  beforeEach(() => {
    process.env.INSTRUCTION_INJECTION = 'native'
  })

  it('synthetic mode delivers once via the append', async () => {
    process.env.INSTRUCTION_INJECTION = 'synthetic'

    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"', 'ALPHA BODY')

    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.synthetics).toHaveLength(1)
    expect(h.synthetics[0].text).toContain('<steering priority="high" reason="relevant files touched" type="instructions">')
    expect(h.synthetics[0].text).toContain('ALPHA BODY')
    expect(h.prompts).toHaveLength(0)

    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.synthetics).toHaveLength(1)
  })

  it('the loader passes the environment value and the agent name to the carrier module and runs the carrier it selects', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)

    carrierMock.resolve.mockReturnValueOnce('synthetic')
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.synthetics).toHaveLength(1)

    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.store.put).toHaveBeenCalledTimes(1)
    expect(carrierMock.resolve).toHaveBeenCalledWith(process.env, 'build')
    expect(carrierMock.resolve).toHaveBeenCalledTimes(2)
  })

  it('unset INSTRUCTION_INJECTION resolves to synthetic', async () => {
    delete process.env.INSTRUCTION_INJECTION

    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')

    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.store.put).not.toHaveBeenCalled()
    expect(h.synthetics).toHaveLength(1)
    expect(h.synthetics[0].text).toContain('ALPHA BODY')
  })

  it('an unknown flag value resolves to native and warns once', async () => {
    const warning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

    process.env.INSTRUCTION_INJECTION = 'bogus-once'

    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.synthetics).toHaveLength(1)
    expect(h.synthetics[0].text).toContain('ALPHA BODY')
    expect(h.store.put).not.toHaveBeenCalled()

    const named = warning.mock.calls.map(call => String(call[0]))

    expect(named.filter(message => message.includes('bogus-once'))).toHaveLength(1)
  })

  it('names a second distinct unknown value once', async () => {
    const warning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)

    process.env.INSTRUCTION_INJECTION = 'bogus-first'
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    process.env.INSTRUCTION_INJECTION = 'bogus-second'
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    const named = warning.mock.calls.map(call => String(call[0]))

    expect(named.filter(message => message.includes('bogus-first'))).toHaveLength(1)
    expect(named.filter(message => message.includes('bogus-second'))).toHaveLength(1)
  })

  it('the carrier log line names the selected carrier and the agent', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(logLines(h)).toContain('carrier=native agent=build')
  })
})
