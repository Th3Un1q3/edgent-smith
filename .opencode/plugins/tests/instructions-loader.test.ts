import { Effect } from 'effect'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const serviceClient = vi.hoisted(() => ({ getClient: vi.fn() }))
const carrierMock = vi.hoisted(() => ({
  publish: vi.fn<typeof import('@plugins/helpers/instruction-carrier').publishInstructionSet>(),
  resolve: vi.fn<typeof import('@plugins/helpers/instruction-carrier').resolveInjectionCarrier>(),
  actual: undefined as unknown as typeof import('@plugins/helpers/instruction-carrier').publishInstructionSet,
  resolveActual: undefined as unknown as typeof import('@plugins/helpers/instruction-carrier').resolveInjectionCarrier,
}))

vi.mock('@plugins/helpers/service-client', () => ({ getClient: serviceClient.getClient }))
vi.mock('@plugins/helpers/instruction-carrier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/helpers/instruction-carrier')>()

  carrierMock.actual = actual.publishInstructionSet
  carrierMock.resolveActual = actual.resolveInjectionCarrier
  return { ...actual, publishInstructionSet: carrierMock.publish, resolveInjectionCarrier: carrierMock.resolve }
})

import { InstructionCarrierUnavailableError } from '@plugins/helpers/instruction-carrier'

import type { CarrierStorage } from '@plugins/helpers/instruction-carrier'

import { InstructionContextHelper } from '@plugins/helpers/instruction-context-helper'

import {
  buildSteeringMessage,
  formatInstruction,
  instructionDescriptionKey,
  instructionEntryKey,
  instructionReferenceKey,
} from '@plugins/helpers/instruction-payload'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions-loader-harness'

import type { Harness } from '@tests/helpers/instructions-loader-harness'

const putKeys = (h: Harness): string[] => h.store.put.mock.calls.map(call => (call[0] as { key: string }).key)

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

describe('instructions-loader (v2)', () => {
  describe('synthetic carrier (legacy cases)', () => {
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
      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
    })

    it('does not re-send an instruction already injected in the session', async () => {
      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha rule\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
      expect(h.prompts).toHaveLength(1)
    })

    it('sends at most 5 full contents; further matches are references', async () => {
      const h = makeHarness()
      for (let i = 1; i <= 6; i++) {
        writeInstruction(h.directory, `rule${i}.instructions.md`, `description: Rule ${i}\napplyTo: "src/**/*.ts"`, `BODY_${i}`)
      }
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      const text = h.prompts[0].text

      expect((text.match(/<instruction>/g) || []).length).toBe(6)
      expect((text.match(/<content>/g) || []).length).toBe(5)
      expect((text.match(/<meta /g) || []).length).toBe(1)
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

    it('injects the pending instructions into the model request system prompt', async () => {
      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"', 'ALPHA BODY')
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      const event = { sessionID: 'ses_1', agent: 'build', system: [], messages: [], model: {}, options: {} }

      await h.injectContext(event)
      expect(JSON.stringify(event.system)).toContain('ALPHA BODY')
    })

    it('reads the file path from filePath when path is absent', async () => {
      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { filePath: 'src/a.ts' } })

      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
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

      expect(h.prompts).toHaveLength(1)
      expect(h.prompts[0].text).toContain('DESC BODY')
      expect(h.prompts[0].text).toContain('ORPHAN BODY')
    })
  })

  it('an empty pending value leaves the system prompt untouched', async () => {
    const h = makeHarness()

    await register(h)

    const event = { sessionID: 'ses_none', agent: 'build', system: [], messages: [], model: {}, options: {} }

    await h.injectContext(event)

    expect(event.system).toEqual([])
  })

  describe('native carrier', () => {
    it('synthetic mode still sends the steering prompt', async () => {
      process.env.INSTRUCTION_INJECTION = 'synthetic'

      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "**/*.ts"', 'ALPHA BODY')
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
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

    it('the loader passes the environment value and the agent name to the carrier module and runs the carrier it selects', async () => {
      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      await register(h)

      carrierMock.resolve.mockReturnValueOnce('synthetic')
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(h.prompts).toHaveLength(1)

      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(h.store.put).toHaveBeenCalledTimes(1)
      expect(carrierMock.resolve).toHaveBeenCalledWith(process.env, 'build')
      expect(carrierMock.resolve).toHaveBeenCalledTimes(2)
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

    it('unset INSTRUCTION_INJECTION resolves to native', async () => {
      delete process.env.INSTRUCTION_INJECTION

      const h = makeHarness()
      const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')

      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(putKeys(h)).toEqual([instructionEntryKey({ path: alpha })])
      expect(h.prompts).toHaveLength(0)
    })

    it('an unknown flag value resolves to native and warns once', async () => {
      const warning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})

      process.env.INSTRUCTION_INJECTION = 'bogus-once'

      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(h.prompts).toHaveLength(0)
      expect(h.store.put).toHaveBeenCalledTimes(1)

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

      const messages = h.logs.map(parts => parts.map(String).join(' '))

      expect(messages).toContain('carrier=native agent=build')
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

      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
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

    it('passes the plugin storage into publishInstructionSet', async () => {
      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      const storage = carrierMock.publish.mock.calls[0]?.[0].storage as CarrierStorage | undefined

      expect(storage).toBeDefined()
      await storage?.set('probe/key', { version: 1 })
      await expect(Promise.resolve(storage?.get('probe/key'))).resolves.toEqual({ version: 1 })
      await expect(Effect.runPromise(h.context.storage.get('probe/key'))).resolves.toEqual({ version: 1 })
    })

    it('a client without the entry method falls back', async () => {
      const h = makeHarness()

      writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      serviceClient.getClient.mockResolvedValue({ session: { instructions: {} } })
      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
      expect(h.store.put).not.toHaveBeenCalled()
    })

    it('counts only bare instr- keys toward the full-body budget', async () => {
      const h = makeHarness()
      const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')

      for (let index = 0; index < 4; index++) h.store.entries.push({ key: `instr-other-${index}`, value: { text: 'x', source: `other-${index}`, priority: 0 } })
      h.store.entries.push({ key: 'instr-desc-other', value: { text: 'x', source: 'described', priority: 0 } })

      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(putKeys(h)).toEqual([instructionEntryKey({ path: alpha })])
      expect((h.store.put.mock.calls[0][0] as { value: { priority: number } }).value.priority).toBe(0)
    })

    it('six matching files produce five full bodies and one reference', async () => {
      const h = makeHarness()
      const paths = Array.from({ length: 6 }, (_, index) => writeInstruction(h.directory, `rule${index + 1}.instructions.md`, `description: Rule ${index + 1}\napplyTo: "src/**/*.ts"`, `BODY_${index + 1}`))

      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      const keys = putKeys(h)
      const references = keys.filter(key => key.startsWith('instr-ref-'))
      const full = keys.filter(key => key.startsWith('instr-') && !key.startsWith('instr-ref-'))

      expect(keys).toHaveLength(6)
      expect(full).toHaveLength(5)
      expect(references).toEqual([instructionReferenceKey({ path: paths[5] })])
      expect((h.store.put.mock.calls[5][0] as { value: { priority: number } }).value.priority).toBe(1)
    })

    it('a file holding a full entry keeps it when the budget is full', async () => {
      const h = makeHarness()
      const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      const alphaKey = instructionEntryKey({ path: alpha })

      for (let index = 0; index < 5; index++) h.store.entries.push({ key: `instr-other-${index}`, value: { text: 'x', source: `other-${index}`, priority: 0 } })
      h.store.entries.push({ key: alphaKey, value: { text: 'OLD', source: alpha, priority: 0 } })

      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(putKeys(h)).toEqual([alphaKey])
      expect((h.store.put.mock.calls[0][0] as { value: { priority: number } }).value.priority).toBe(0)
    })

    it('an oversize file is written as a reference and its full key is swept', async () => {
      const h = makeHarness()
      const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'y'.repeat(262_200))
      const alphaKey = instructionEntryKey({ path: alpha })
      const referenceKey = instructionReferenceKey({ path: alpha })

      h.store.entries.push({ key: alphaKey, value: { text: 'OLD', source: alpha, priority: 0 } })

      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(putKeys(h)).toEqual([referenceKey])
      expect((h.store.put.mock.calls[0][0] as { value: { priority: number } }).value.priority).toBe(1)
      expect(h.store.remove).toHaveBeenCalledWith({ sessionID: 'ses_1', key: alphaKey })
      expect(h.store.entries.map(entry => entry.key)).toEqual([referenceKey])
    })

    it('counts string and null snapshot values toward the full-body budget', async () => {
      const h = makeHarness()
      const alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')

      h.store.entries.push({ key: 'instr-legacy-string', value: 'LEGACY' }, { key: 'instr-null-value', value: null })

      await register(h)
      await h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

      expect(putKeys(h)).toEqual([instructionEntryKey({ path: alpha })])
      expect((h.store.put.mock.calls[0][0] as { value: { priority: number } }).value.priority).toBe(0)
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

  describe('fallback seeding (D-08)', () => {
    const forceFallback = (): void => {
      carrierMock.publish.mockResolvedValueOnce({ outcome: 'fallback', published: [], statuses: [] })
    }

    const logLines = (h: Harness): string[] => h.logs.map(parts => parts.map(String).join(' '))

    const touch = (h: Harness): Promise<void> =>
      h.before({ tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'src/a.ts' } })

    let h: Harness
    let alpha: string

    beforeEach(async () => {
      h = makeHarness()
      alpha = writeInstruction(h.directory, 'alpha.instructions.md', 'description: Alpha\napplyTo: "src/**/*.ts"', 'ALPHA BODY')
      await register(h)
    })

    it('falls back and seeds exclusions from listed entries', async () => {
      writeInstruction(h.directory, 'beta.instructions.md', 'description: Beta\napplyTo: "src/**/*.ts"', 'BETA BODY')
      h.store.entries.push({ key: instructionEntryKey({ path: alpha }), value: { text: 'ALPHA BODY', source: alpha, priority: 0 } })
      forceFallback()
      await touch(h)

      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('BETA BODY')])
      expect(h.prompts[0].text).not.toContain('ALPHA BODY')
    })

    it('seedExclusions suppresses entries already listed', async () => {
      h.store.entries.push({ key: instructionEntryKey({ path: alpha }), value: { text: 'ALPHA BODY', source: alpha, priority: 0 } })
      forceFallback()
      await touch(h)
      process.env.INSTRUCTION_INJECTION = 'synthetic'
      await touch(h)

      expect(h.prompts).toHaveLength(0)
    })

    it('seeds the instruction identity from value.source', async () => {
      h.store.entries.push({ key: 'instr-renamed', value: { text: 'ALPHA BODY', source: alpha, priority: 0 } })
      forceFallback()
      await touch(h)

      expect(h.prompts).toHaveLength(0)
    })

    it('a legacy string-valued entry seeds the slug\'s identity', async () => {
      h.store.entries.push({ key: 'instr-alpha', value: 'LEGACY ALPHA' })
      forceFallback()
      await touch(h)

      expect(h.prompts).toHaveLength(0)
    })

    it('a failed seeding list seeds nothing and logs once', async () => {
      serviceClient.getClient.mockResolvedValue({ session: { instructions: {} } })
      await touch(h)

      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
      expect(logLines(h).filter(line => line.includes('seeding'))).toHaveLength(1)
    })

    it('a rejecting synthetic seeding list warns once, prompts once and removes nothing', async () => {
      process.env.INSTRUCTION_INJECTION = 'synthetic'
      h.store.list.mockRejectedValueOnce(new Error('list unavailable'))
      await touch(h)
      expect(h.store.list).toHaveBeenCalledTimes(1)
      expect(logLines(h).filter(line => line.includes('synthetic seeding list failed (unknown)'))).toHaveLength(1)
      expect(h.prompts.map(prompt => prompt.text)).toEqual([expect.stringContaining('ALPHA BODY')])
      expect(h.store.remove).not.toHaveBeenCalled()
    })

    it('a publish-returned fallback lists once', async () => {
      h.store.entries.push({ key: instructionEntryKey({ path: alpha }), value: { text: 'ALPHA BODY', source: alpha, priority: 0 } })
      forceFallback()
      await touch(h)

      expect(h.store.list).toHaveBeenCalledTimes(1)
      expect(h.prompts).toHaveLength(0)
    })

    it('a fallback issues no remove', async () => {
      forceFallback()
      await touch(h)

      expect(h.prompts).toHaveLength(1)
      expect(h.store.remove).not.toHaveBeenCalled()
    })

    it('native to synthetic keeps the entry list intact', async () => {
      process.env.INSTRUCTION_INJECTION = 'native'
      await touch(h)

      const published = h.store.entries.map(entry => entry.key)

      process.env.INSTRUCTION_INJECTION = 'synthetic'
      await touch(h)

      expect(published).toEqual([instructionEntryKey({ path: alpha })])
      expect(h.store.entries.map(entry => entry.key)).toEqual(published)
      expect(h.store.remove).not.toHaveBeenCalled()
      expect(h.prompts).toHaveLength(0)
    })

    it('synthetic to native duplicates a block at most once and deletes nothing', async () => {
      const alphaKey = instructionEntryKey({ path: alpha })

      process.env.INSTRUCTION_INJECTION = 'synthetic'
      await touch(h)
      process.env.INSTRUCTION_INJECTION = 'native'
      await touch(h)

      const promptMentions = (h.prompts[0]?.text.match(/ALPHA BODY/gu) ?? []).length
      const entryWrites = putKeys(h).filter(key => key === alphaKey).length

      expect(promptMentions + entryWrites).toBeLessThanOrEqual(2)
      expect(entryWrites).toBe(1)
      expect(new Set(h.store.entries.map(entry => entry.key)).size).toBe(h.store.entries.length)
      expect(h.store.remove).not.toHaveBeenCalled()
    })

    it('switching modes deletes no entry', async () => {
      process.env.INSTRUCTION_INJECTION = 'synthetic'
      await touch(h)
      process.env.INSTRUCTION_INJECTION = 'native'
      await touch(h)

      const published = h.store.entries.map(entry => entry.key)

      process.env.INSTRUCTION_INJECTION = 'synthetic'
      await touch(h)

      expect(published).toHaveLength(1)
      expect(h.store.entries.map(entry => entry.key)).toEqual(published)
      expect(h.store.remove).not.toHaveBeenCalled()
    })
  })
})
