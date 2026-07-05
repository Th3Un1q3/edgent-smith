import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import Bun, { Glob } from './bun'

let tmp: string

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bun-mock-test-'))
})

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true })
})

describe('mock Bun.Glob', () => {
  it('exposes scan as an async iterable', async () => {
    fs.mkdirSync(path.join(tmp, 'nested'))
    fs.writeFileSync(path.join(tmp, 'a.txt'), 'a')
    fs.writeFileSync(path.join(tmp, 'nested', 'b.txt'), 'b')

    const glob = new Glob('**/*.txt')
    const results: string[] = []
    for await (const file of glob.scan({ cwd: tmp, dot: false, absolute: false })) {
      results.push(file)
    }

    expect(results.sort()).toEqual(['a.txt', 'nested/b.txt'].sort())
  })

  it.skipIf(process.platform !== 'linux')('skips non-directory and pseudo-filesystem paths on Linux', async () => {
    const glob = new Glob('**/*.txt')
    const results: string[] = []
    for await (const file of glob.scan({ cwd: '/proc/self/net', dot: true, absolute: false })) {
      results.push(file)
    }

    expect(results).toEqual([])
  })

  it('ignores paths that throw non-EACCES/EPERM readdir errors', async () => {
    const filePath = path.join(tmp, 'not-a-directory')
    fs.writeFileSync(filePath, 'file content')

    const glob = new Glob('**/*.txt')
    const results: string[] = []
    await expect(
      (async () => {
        for await (const file of glob.scan({ cwd: filePath, dot: false, absolute: false })) {
          results.push(file)
        }
      })()
    ).resolves.not.toThrow()
    expect(results).toEqual([])
  })

  it('caches the compiled regex in the constructor', () => {
    const glob = new Glob('src/**/*.ts')
    expect(glob.regex).toBeInstanceOf(RegExp)
    expect(glob.match('src/index.ts')).toBe(true)
    expect(glob.match('src/lib/util.ts')).toBe(true)
    expect(glob.match('test/index.ts')).toBe(false)
  })

  it('matches nested directory patterns and single-star boundaries', () => {
    const glob = new Glob('.github/**/*.md')
    expect(glob.match('.github/instructions/tdd.md')).toBe(true)
    expect(glob.match('.github/workflows/ci.yml')).toBe(false)
    expect(glob.match('src/nested/index.ts')).toBe(false)
  })

  it('returns file-like methods from Bun.file', async () => {
    const filePath = path.join(tmp, 'data.json')
    fs.writeFileSync(filePath, JSON.stringify({ ok: true }))

    const file = Bun.file(filePath)

    expect(file.text).toEqual(expect.any(Function))
    expect(file.json).toEqual(expect.any(Function))
    expect(file.exists).toEqual(expect.any(Function))
    expect(file.stream).toEqual(expect.any(Function))

    expect(await file.exists()).toBe(true)
    expect(await file.text()).toBe('{"ok":true}')
    expect(await file.json()).toEqual({ ok: true })

    const chunks: Uint8Array[] = []
    for await (const chunk of file.stream()) {
      chunks.push(chunk)
    }
    expect(Buffer.concat(chunks).toString('utf-8')).toBe('{"ok":true}')
  })

  it('reports non-existent files from Bun.file.exists', async () => {
    const file = Bun.file(path.join(tmp, 'missing.txt'))
    expect(await file.exists()).toBe(false)
  })
})
