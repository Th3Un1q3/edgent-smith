import { unlinkSync } from 'node:fs'

import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceClient = vi.hoisted(() => ({ getClient: vi.fn() }))
const indexerMock = vi.hoisted(() => ({
  create: vi.fn<typeof import('@plugins/helpers/instruction-indexer').createIndex>(),
  actual: undefined as unknown as typeof import('@plugins/helpers/instruction-indexer').createIndex,
}))

vi.mock('@plugins/helpers/service-client', () => ({ getClient: serviceClient.getClient }))
vi.mock('@plugins/helpers/instruction-indexer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/helpers/instruction-indexer')>()

  indexerMock.actual = actual.createIndex
  return { ...actual, createIndex: indexerMock.create }
})

import { InstructionContextHelper } from '@plugins/helpers/instruction-context-helper'

import {
  instructionCollisions,
  instructionDescriptionKey,
  instructionEntryKey,
  instructionReferenceKey,
} from '@plugins/helpers/instruction-payload'

import { keys, makeHarness, register, touch, writeInstruction } from '@tests/helpers/instructions-loader-harness'

import type { Harness } from '@tests/helpers/instructions-loader-harness'

const SRC_RULE = 'description: Alpha\napplyTo: "src/**/*.ts"'

const setup = (frontmatter: string = SRC_RULE): { h: Harness, alpha: string } => {
  const h = makeHarness()
  return { h, alpha: writeInstruction(h.directory, 'alpha.instructions.md', frontmatter, 'ALPHA BODY') }
}

const writeBeta = (h: Harness, frontmatter: string = SRC_RULE): string =>
  writeInstruction(h.directory, 'beta.instructions.md', frontmatter, 'BETA BODY')

const registerAndTouch = async (h: Harness): Promise<void> => {
  await register(h)
  await touch(h)
}

beforeEach(() => {
  serviceClient.getClient.mockReset()
  indexerMock.create.mockReset()
  indexerMock.create.mockImplementation(indexerMock.actual)
})

describe('instructions-loader sweep and freshness (D-09)', () => {
  it('a deleted source file is swept on the next touch', async () => {
    const { h } = setup()
    const beta = writeBeta(h)

    await registerAndTouch(h)

    const betaKey = instructionEntryKey({ path: beta })

    unlinkSync(beta)
    await touch(h)

    expect(h.remove).toHaveBeenCalledWith({ sessionID: 'ses_1', key: betaKey })
    expect(keys(h)).toHaveLength(1)
  })

  it('rebuilds the helper when an instruction file is deleted', async () => {
    const { h } = setup()
    const beta = writeBeta(h)

    await registerAndTouch(h)
    expect(indexerMock.create).toHaveBeenCalledTimes(1)

    unlinkSync(beta)
    await touch(h)
    expect(indexerMock.create).toHaveBeenCalledTimes(2)

    await touch(h)
    expect(indexerMock.create).toHaveBeenCalledTimes(2)
  })

  it('keeps a key whose file is in allPaths but not indexedPaths', async () => {
    const { h } = setup()
    const beta = writeBeta(h, `${SRC_RULE}\nexcludeAgents: build`)
    const betaKey = instructionEntryKey({ path: beta })

    h.entries.push({ key: betaKey, value: { text: 'BETA BODY', source: beta, priority: 0 } })
    await registerAndTouch(h)

    expect(h.remove).not.toHaveBeenCalled()
    expect(keys(h)).toContain(betaKey)
  })

  it('when both keys exist for an untouched identity the full-body key stays live', async () => {
    const { h, alpha } = setup('description: Alpha\napplyTo: "docs/**"')

    writeBeta(h)

    const fullKey = instructionEntryKey({ path: alpha })
    const referenceKey = instructionReferenceKey({ path: alpha })

    h.entries.push(
      { key: fullKey, value: { text: 'ALPHA BODY', source: alpha, priority: 0 } },
      { key: referenceKey, value: { text: 'ALPHA REF', source: alpha, priority: 1 } },
    )
    await registerAndTouch(h)

    expect(h.remove).toHaveBeenCalledWith({ sessionID: 'ses_1', key: referenceKey })
    expect(h.remove).not.toHaveBeenCalledWith({ sessionID: 'ses_1', key: fullKey })
  })

  it('a zero-match touch removes no entry', async () => {
    const { h } = setup()

    h.entries.push({ key: 'instr-stale-key', value: { text: 'x', source: '/gone/file.instructions.md', priority: 0 } })
    await h.register()
    await touch(h, { tool: 'read', sessionID: 'ses_1', agent: 'build', input: { path: 'docs/readme.md' } })

    expect(h.list).not.toHaveBeenCalled()
    expect(h.remove).not.toHaveBeenCalled()
    expect(h.put).not.toHaveBeenCalled()
    expect(h.context.session.prompt).not.toHaveBeenCalled()
  })

  const untouched = [
    ['a foreign instr-task-skills- key is never removed', 'instr-task-skills-review', { text: 'S', source: 's', priority: 0 }],
    ['a description key is never swept', instructionDescriptionKey({ description: 'old description' }), { text: 'O', source: 'old description', priority: 0 }],
    ['a key outside the instr- families is untouched', 'session/note', 'keep me'],
  ] as const

  it.each(untouched)('%s', async (_name, key, value) => {
    const { h } = setup()

    h.entries.push({ key, value })
    await registerAndTouch(h)

    expect(h.remove).not.toHaveBeenCalled()
    expect(keys(h)).toContain(key)
  })
})

describe('collision sets derived from the live identity set (D-03)', () => {
  it('a previously hashed full identity keeps its hashed key when matched alone', async () => {
    const h = makeHarness()
    const alpha = writeInstruction(h.directory, 'a b.instructions.md', 'description: Alpha\napplyTo: "src/**"', 'ALPHA BODY')
    const beta = writeInstruction(h.directory, 'a-b.instructions.md', 'description: Beta\napplyTo: "docs/**"', 'BETA BODY')
    const hashedKey = instructionEntryKey({ path: alpha }, instructionCollisions([{ path: alpha }, { path: beta }]))

    h.entries.push({ key: hashedKey, value: { text: 'OLD', source: alpha, priority: 0 } })
    for (let index = 0; index < 4; index++) {
      h.entries.push({ key: `instr-other-${index}`, value: { text: 'x', source: `other-${index}`, priority: 0 } })
    }

    await registerAndTouch(h)

    expect(hashedKey).not.toBe(instructionEntryKey({ path: alpha }))
    expect(keys(h)).toContain(hashedKey)
    expect(keys(h)).not.toContain(instructionEntryKey({ path: alpha }))
    expect(h.entries.find(entry => entry.key === hashedKey)?.value).toMatchObject({ source: alpha, priority: 0 })
    expect(h.remove).not.toHaveBeenCalledWith({ sessionID: 'ses_1', key: hashedKey })
  })

  it('two path-less identities that collapse to one slug both take the hash suffix', async () => {
    const h = makeHarness()

    vi.spyOn(InstructionContextHelper.prototype, 'resolveInstructions').mockResolvedValueOnce([
      { description: 'Foo', content: 'FOO BODY', idempotencyKey: 'instruction_load:Foo' },
      { description: 'foo', content: 'foo BODY', idempotencyKey: 'instruction_load:foo' },
    ])
    await h.register()
    await touch(h)

    const descriptionKeys = keys(h).filter(key => key.startsWith('instr-desc-'))
    const collisions = new Set(['foo'])
    const expected = [
      instructionDescriptionKey({ description: 'Foo' }, collisions),
      instructionDescriptionKey({ description: 'foo' }, collisions),
    ]

    expect(descriptionKeys).toHaveLength(2)
    expect([...descriptionKeys].sort((a, b) => a.localeCompare(b))).toEqual(expected.sort((a, b) => a.localeCompare(b)))
    expect(descriptionKeys.every(key => /^instr-desc-foo-[0-9a-f]{7}$/u.test(key))).toBe(true)
    expect(keys(h)).not.toContain('instr-desc-foo')
  })
})

describe('server-side oversize rejection (D-06 row 6)', () => {
  it('a server-side oversize rejection writes the reference entry instead of skipping', async () => {
    const { h, alpha } = setup()
    const fullKey = instructionEntryKey({ path: alpha })
    const referenceKey = instructionReferenceKey({ path: alpha })

    h.entries.push({ key: fullKey, value: { text: 'OLD', source: alpha, priority: 0 } })
    h.put.mockRejectedValueOnce({ _tag: 'InstructionEntryValueTooLargeError' })

    await registerAndTouch(h)

    expect(h.entries.map(entry => entry.key)).toContain(referenceKey)
    expect(h.entries.find(entry => entry.key === referenceKey)?.value).toMatchObject({ source: alpha, priority: 1 })
    expect(h.entries.map(entry => entry.key)).not.toContain(fullKey)
    expect(h.remove).toHaveBeenCalledWith({ sessionID: 'ses_1', key: fullKey })
    expect(h.context.session.prompt).not.toHaveBeenCalled()
  })
})
