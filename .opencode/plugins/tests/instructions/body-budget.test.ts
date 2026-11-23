import { beforeEach, describe, expect, it } from 'vitest'

import '@tests/helpers/instructions/loader-mocks'

import { installLoaderSetup, putKeys } from '@tests/helpers/instructions/loader-setup'

import {
  instructionEntryKey,
  instructionReferenceKey,
} from '@plugins/helpers/instructions/payload'

import { makeHarness, register, writeInstruction } from '@tests/helpers/instructions/loader-harness'

installLoaderSetup()

describe('instructions-loader full-body budget', () => {
  beforeEach(() => {
    process.env.INSTRUCTION_INJECTION = 'native'
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
})
