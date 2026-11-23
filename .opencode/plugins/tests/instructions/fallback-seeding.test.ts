import { beforeEach, describe, expect, it } from 'vitest'

import '@tests/helpers/instructions/loader-mocks'

import { carrierMock, installLoaderSetup, logLines, putKeys, serviceClient } from '@tests/helpers/instructions/loader-setup'

import { instructionEntryKey } from '@plugins/helpers/instructions/payload'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions/loader-harness'

import type { Harness } from '@tests/helpers/instructions/loader-harness'

installLoaderSetup()

describe('instructions-loader fallback seeding (D-08)', () => {
  beforeEach(() => {
    process.env.INSTRUCTION_INJECTION = 'native'
  })

  const forceFallback = (): void => {
    carrierMock.publish.mockResolvedValueOnce({ outcome: 'fallback', published: [], statuses: [] })
  }

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

    expect(h.synthetics.map(message => message.text)).toEqual([expect.stringContaining('BETA BODY')])
    expect(h.synthetics[0].text).not.toContain('ALPHA BODY')
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

    expect(h.synthetics.map(message => message.text)).toEqual([expect.stringContaining('ALPHA BODY')])
    expect(logLines(h).filter(line => line.includes('seeding'))).toHaveLength(1)
  })

  it('a rejecting synthetic seeding list warns once, synthetics once and removes nothing', async () => {
    process.env.INSTRUCTION_INJECTION = 'synthetic'
    h.store.list.mockRejectedValueOnce(new Error('list unavailable'))
    await touch(h)
    expect(h.store.list).toHaveBeenCalledTimes(1)
    expect(logLines(h).filter(line => line.includes('synthetic seeding list failed (unknown)'))).toHaveLength(1)
    expect(h.synthetics.map(message => message.text)).toEqual([expect.stringContaining('ALPHA BODY')])
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

    expect(h.synthetics).toHaveLength(1)
    expect(h.store.remove).not.toHaveBeenCalled()
  })

  it('native to synthetic drains native entries', async () => {
    process.env.INSTRUCTION_INJECTION = 'native'
    await touch(h)

    const published = h.store.entries.map(entry => entry.key)

    process.env.INSTRUCTION_INJECTION = 'synthetic'
    await touch(h)

    expect(published).toEqual([instructionEntryKey({ path: alpha })])
    expect(h.store.entries.map(entry => entry.key)).toEqual([])
    expect(h.prompts).toHaveLength(0)
  })

  it('synthetic to native duplicates a block at most once and deletes nothing', async () => {
    const alphaKey = instructionEntryKey({ path: alpha })

    process.env.INSTRUCTION_INJECTION = 'synthetic'
    await touch(h)
    process.env.INSTRUCTION_INJECTION = 'native'
    await touch(h)

    const promptMentions = (String(h.synthetics[0]?.text).match(/ALPHA BODY/gu) ?? []).length
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
