import { Effect } from 'effect'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import '@tests/helpers/instructions/loader-mocks'

import { carrierMock, installLoaderSetup, putKeys, serviceClient } from '@tests/helpers/instructions/loader-setup'

import { InstructionContextHelper } from '@plugins/instructions/context-helper'

import {
  buildSteeringMessage,
  formatInstruction,
  instructionDescriptionKey,
  instructionEntryKey,
} from '@plugins/helpers/instructions/payload'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions/loader-harness'

import type { CarrierStorage } from '@plugins/instructions/carrier'

installLoaderSetup()

describe('instructions-loader native publishing', () => {
  beforeEach(() => {
    process.env.INSTRUCTION_INJECTION = 'native'
  })

  it('publishes one instr- entry per matching file and sends no prompt', async () => {
    const h = makeHarness()
    const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    const beta = writeInstruction(h.directory, 'beta.instructions.md', 'description: Beta\napplyTo: "src/**/*.ts"', 'BETA BODY')

    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(putKeys(h)).toEqual([
      instructionEntryKey({ path: alpha }),
      instructionEntryKey({ path: beta }),
    ])
    expect(h.store.put.mock.calls.map(call => (call[0] as { value: { priority: number } }).value.priority)).toEqual([0, 0])
    expect(h.prompts).toHaveLength(0)
  })

  it('an entry value\'s text equals the steering block for that file', async () => {
    const h = makeHarness()
    const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    const instruction = { path: alpha, description: 'Alpha', applyTo: 'src/**/*.ts', content: 'ALPHA BODY', idempotencyKey: 'instruction_load:alpha' }

    vi.spyOn(InstructionContextHelper.prototype, 'resolveInstructions').mockResolvedValueOnce([instruction])
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    const value = (h.store.put.mock.calls[0][0] as { value: { text: string, source: string, priority: number } }).value

    expect(value.text).toBe(buildSteeringMessage(formatInstruction(instruction, false)))
    expect(value.source).toBe(alpha)
    expect(value.priority).toBe(0)
  })

  it('a native touch sends the directory to the entry client', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(carrierMock.publish.mock.calls[0]?.[0].directory).toBe(h.directory)
    expect(serviceClient.getClient).toHaveBeenCalledWith(undefined, h.directory)
  })

  it('publishes a path-less instruction under the description key and keeps the raw description as source', async () => {
    const h = makeHarness()
    const description = 'Use src/**/*.ts, never api/'

    vi.spyOn(InstructionContextHelper.prototype, 'resolveInstructions').mockResolvedValueOnce([
      { description, applyTo: 'src/**', content: 'LOOSE BODY', idempotencyKey: `instruction_load:${description}` }])
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(putKeys(h)).toEqual([instructionDescriptionKey({ description })])
    expect((h.store.put.mock.calls[0][0] as { value: { source: string, priority: number } }).value).toMatchObject({
      source: description,
      priority: 0,
    })
    expect(h.prompts).toHaveLength(0)
  })

  it('a second touch with the same file performs no second put', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(h.store.put).toHaveBeenCalledTimes(1)
    expect(h.prompts).toHaveLength(0)
  })

  it('passes the plugin storage into publishInstructionSet', async () => {
    const h = makeHarness()

    writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    const storage = carrierMock.publish.mock.calls[0]?.[0].storage as CarrierStorage | undefined

    expect(storage).toBeDefined()
    if (storage === undefined) throw new Error('publishInstructionSet received no storage')
    await storage.set('probe/key', { version: 1 })
    await expect(Promise.resolve(storage.get('probe/key'))).resolves.toEqual({ version: 1 })
    await expect(Effect.runPromise(h.context.storage.get('probe/key'))).resolves.toEqual({ version: 1 })
  })

  it('collapses duplicate paths to one candidate', async () => {
    const h = makeHarness()
    const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')

    vi.spyOn(InstructionContextHelper.prototype, 'resolveInstructions').mockResolvedValueOnce([
      { path: alpha, applyTo: 'src/**', content: 'FIRST BODY', idempotencyKey: 'instruction_load:first' }, { path: alpha, applyTo: 'src/**', content: 'SECOND BODY', idempotencyKey: 'instruction_load:second' },
    ])
    await register(h)
    await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    expect(putKeys(h)).toEqual([instructionEntryKey({ path: alpha })])
  })
})
