import { Effect } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import '@tests/helpers/instructions/loader-mocks'

import { installLoaderSetup } from '@tests/helpers/instructions/loader-setup'

import { InstructionContextHelper } from '@plugins/instructions/context-helper'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions/loader-harness'

installLoaderSetup()

describe('instructions-loader synthetic carrier (legacy cases)', () => {
  let syntheticPrevious: string | undefined

  beforeEach(() => {
    syntheticPrevious = process.env.INSTRUCTION_INJECTION
    process.env.INSTRUCTION_INJECTION = 'synthetic'
  })

  afterEach(() => {
    if (syntheticPrevious === undefined) delete process.env.INSTRUCTION_INJECTION
    else process.env.INSTRUCTION_INJECTION = syntheticPrevious
  })

  it('sends the matching instruction when a targeted file is touched', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'name: alpha\ndescription: Alpha rule\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.synthetics.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
  })

  it('does not re-send an instruction already injected in the session', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha rule\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.synthetics).toHaveLength(1)
  })

  it('sends at most 5 full contents; further matches are references', async () => {
    const h = makeHarness()
    for (let index = 1; index <= 6; index++) {
      writeInstruction(h.directory, `rule${index}.instructions.md`, `description: Rule ${index}\napplyTo: "src/**/*.ts"`, `BODY_${index}`)
    }
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    const text = h.synthetics[0].text as string

    const occurrences = (needle: string): number => text.split(needle).length - 1

    expect(occurrences('<instruction>')).toBe(6)
    expect(occurrences('<content>')).toBe(5)
    expect(occurrences('<meta ')).toBe(1)
  })

  it('ignores tools that are not targeted', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"', 'ALPHA BODY')

    await register(h)
    await h.before({ tool: 'bash', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(0)
  })

  it('excludes instructions whose excludeAgents matches the session agent', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"\nexcludeAgents: build', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    expect(h.prompts).toHaveLength(0)
  })

  it('reads the file path from filePath when path is absent', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { filePath: 'src/a.ts' } })

    expect(h.synthetics.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
  })

  it('ignores a touch whose path is empty', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: '' } })

    expect(h.prompts).toHaveLength(0)
    expect(h.store.list).not.toHaveBeenCalled()
  })

  it('defaults the agent to build when neither the event nor the session names one', async () => {
    const h = makeHarness()
    const session = h.context.session as unknown as { get: () => Effect.Effect<{ agent: string }> }

    session.get = () => Effect.succeed({ agent: '' })

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', input: { path: 'src/a.ts' } })

    const messages = h.logs.map(parts => parts.map(String).join(' '))

    expect(messages).toContain('carrier=synthetic agent=build')
  })

  it('sends a description-only instruction and one with no identity', async () => {
    const h = makeHarness()

    vi.spyOn(InstructionContextHelper.prototype, 'resolveInstructions').mockResolvedValueOnce([
      { description: 'Desc only', applyTo: 'src/**', content: 'DESC BODY', idempotencyKey: 'instruction_load:Desc only' }, { applyTo: 'src/**', content: 'ORPHAN BODY', idempotencyKey: 'instruction_load:orphan' },
    ])
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.synthetics).toHaveLength(1)
    expect(h.synthetics[0].text).toContain('DESC BODY')
    expect(h.synthetics[0].text).toContain('ORPHAN BODY')
  })
})
