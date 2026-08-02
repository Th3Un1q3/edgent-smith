import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import * as fs from 'node:fs'

import * as os from 'node:os'

import path from 'node:path'

import { SessionStorage, FileSystemSessionStorageAdapter, SESSION_FIELDS } from '@plugins/helpers/kv-store'

describe('SESSION_FIELDS', () => {
  it.each(Object.entries(SESSION_FIELDS))('enum key %s maps to value %s', (_key, value) => {
    expect(SESSION_FIELDS[_key as keyof typeof SESSION_FIELDS]).toBe(value)
  })
})

describe('FileSystemSessionStorageAdapter', () => {
  let temporaryDirectory: string
  let adapter: FileSystemSessionStorageAdapter

  const writeFixture = (id: string, content: string) => {
    fs.mkdirSync(temporaryDirectory, { recursive: true })
    fs.writeFileSync(path.join(temporaryDirectory, `${id}.json`), content, 'utf8')
  }

  const readJson = (filePath: string) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-store-test-'))
    adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
  })
  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it('constructs with default path and reads undefined for missing session', () => {
    const adapter = new FileSystemSessionStorageAdapter()

    expect(adapter).toBeInstanceOf(FileSystemSessionStorageAdapter)
    expect(adapter.read('non-existent-default')).toBeUndefined()
  })

  describe('read()', () => {
    it.each([
      { name: 'valid JSON', content: JSON.stringify({ key: 'value' }), expected: { key: 'value' } },
      { name: 'empty file', content: '', expected: {} },
      { name: 'whitespace only', content: '   \n  ', expected: {} },
      { name: 'missing file', content: null, expected: undefined },
      { name: 'invalid JSON', content: '{invalid json', expected: undefined },
    ])('returns $expected when file has $name', ({ content, expected }) => {
      const id = `ses-${Math.random().toString(36).slice(2, 8)}`
      if (content !== null) writeFixture(id, content)
      expect(adapter.read(id)).toEqual(expected)
    })
  })

  describe('write()', () => {
    it('writes state to a new file', () => {
      adapter.write('ses-new', { foo: 'bar', num: 42 })
      expect(readJson(path.join(temporaryDirectory, 'ses-new.json'))).toEqual({ foo: 'bar', num: 42 })
    })
    it('overwrites existing file with new state', () => {
      writeFixture('ses-over', JSON.stringify({ old: true }))
      adapter.write('ses-over', { new: 'data' })
      expect(readJson(path.join(temporaryDirectory, 'ses-over.json'))).toEqual({ new: 'data' })
    })
    it('creates parent directory if it does not exist', () => {
      const deep = path.join(temporaryDirectory, 'deep', 'nest')

      const adapter = new FileSystemSessionStorageAdapter(deep)

      expect(fs.existsSync(deep)).toBe(false)
      adapter.write('ses-deep', { nested: true })
      expect(fs.existsSync(path.join(deep, 'ses-deep.json'))).toBe(true)
    })
  })
})

describe('SessionStorage', () => {
  let temporaryDirectory: string
  let adapter: FileSystemSessionStorageAdapter
  let storage: SessionStorage
  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kv-store-test-'))
    adapter = new FileSystemSessionStorageAdapter(temporaryDirectory)
    storage = new SessionStorage(adapter)
  })
  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true })
  })

  it('does not expose a reset method', () => {
    expect('reset' in SessionStorage).toBe(false)
  })
  it('constructs with default adapter when none provided', () => {
    const adapter = new SessionStorage()

    expect(adapter.readState('non-existent-default', state => state)).toBeUndefined()
  })
  it('returns reader result when state exists', () => {
    adapter.write('ses-r', { count: 5, name: 'test' })

    const result = storage.readState<{ count: number, name: string }, { doubled: number, upperName: string }>(
      'ses-r', state => ({ doubled: state.count * 2, upperName: state.name.toUpperCase() }),
    )

    expect(result).toEqual({ doubled: 10, upperName: 'TEST' })
  })
  it('returns undefined when state does not exist', () => {
    expect(storage.readState('non-existent', state => state)).toBeUndefined()
  })
  it('returns undefined when state is missing even if reader handles undefined', () => {
    const result = storage.readState<{ count: number }, string>(
      'non-existent', state => state?.count == null ? 'fallback' : String(state.count),
    )

    expect(result).toBeUndefined()
  })
  it('creates new state when session does not exist', () => {
    const result = storage.updateState<{ initialized: boolean }, { initialized: boolean }>(
      'ses-new', () => ({ initialized: true }),
    )

    expect(result).toEqual({ initialized: true })
    expect(adapter.read('ses-new')).toEqual({ initialized: true })
  })
  it('merges updater result with existing state', () => {
    adapter.write('ses-upd', { existing: 'value', count: 1 })

    const result = storage.updateState<{ existing: string, count: number, added: string }, { existing: string, count: number, added: string }>(
      'ses-upd', content => ({ ...content, count: content.count + 1, added: 'new' }),
    )

    expect(result).toEqual({ existing: 'value', count: 2, added: 'new' })
    expect(adapter.read('ses-upd')).toEqual({ existing: 'value', count: 2, added: 'new' })
  })
  it('returns updater result for chaining', () => {
    expect(storage.updateState<{ step: number }, number>('ses-chain', () => 42)).toBe(42)
  })
})
