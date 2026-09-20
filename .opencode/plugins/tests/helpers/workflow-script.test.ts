import { describe, expect, it, vi } from 'vitest'

import {
  buildWorkflowFunction,
  checkScript,
  scanForbiddenToken,
  stripLiteralsAndComments,
} from '@plugins/helpers/workflow-script'
import type { SubtaskInput, SubtaskResult, WorkflowHelpers } from '@plugins/helpers/workflow-types'

const makeResult = (outputText = ''): SubtaskResult => ({
  outputText,
  task_id: 'task-1',
  status: 'ok',
  durationMs: 0,
  truncated: false,
})

const inputToPrompt = (input: SubtaskInput): string =>
  typeof input === 'string' ? input : input.prompt

const createHelpers = (): WorkflowHelpers => ({
  subtask: async input => makeResult(inputToPrompt(input)),
  log: () => {},
  progress: () => {},
})

describe('scanForbiddenToken', () => {
  it.each([
    ['require(\'fs\')', 'require('],
    ['import(\'x\')', 'import('],
    ['process.exit(1)', 'process'],
    ['globalThis.x = 1', 'globalThis'],
    ['new Function(\'return 1\')', 'new Function'],
    ['({}).constructor.constructor(\'x\')', 'constructor'],
    ['fetch(\'http://x\')', 'fetch('],
    ['node:fs', 'node:'],
    ['Bun.file(\'x\')', 'Bun'],
    ['import.meta.url', 'import.meta'],
    ['import value from \'module\'', 'import'],
    ['const socket = new WebSocket("wss://x")', 'WebSocket'],
    ['const request = new XMLHttpRequest()', 'XMLHttpRequest'],
    ['const child = child_process', 'child_process'],
    ['global.value = 1', 'global'],
    ['Deno.exit(1)', 'Deno'],
    ['eval(\'x\')', 'eval('],
    ['`${process.exit(1)}`', 'process'],
    ['`prefix ${require(\'fs\')} suffix`', 'require('],
    ['`outer ${`inner ${globalThis}`}`', 'globalThis'],
    ['`${ (() => { return process.env })() }`', 'process'],
    ['`nested ${`deep ${require(\'fs\')}`}`', 'require('],
  ])('flags %s as %s', (script, token) => {
    expect(scanForbiddenToken(script)).toBe(token)
  })

  it.each([
    ['subtask({ prompt: "do not use process.exit or require(fs)" })'],
    ['subtask({ prompt: \'call fetch( and eval( only if needed\' })'],
    ['subtask({ prompt: `use process, require(fs), and import(x)` })'],
    ['// process.exit is forbidden\nconst value = 1'],
    ['/* fetch( and globalThis are blocked */ const value = 1'],
    ['`do not use process.exit`'],
    ['`value ${ x + "process" }`'],
    ['`${ /* require(fs) */ 1 }`'],
    ['`computed ${ [1, 2].map((n) => `${n} items`) }`'],
    ['`braces ${ { key: "process" } }`'],
  ])('ignores forbidden words inside literals and comments: %s', (script) => {
    expect(scanForbiddenToken(script)).toBeUndefined()
  })

  it('ignores escaped quotes and backslashes inside literals', () => {
    const script
      = String.raw`const message = "a \" process \" and require(fs)"; const path = "c:\\temp process"`

    expect(scanForbiddenToken(script)).toBeUndefined()
  })

  it('allows a normal orchestration script', () => {
    const script = [
      'const first = await subtask({ prompt: "first" })',
      'const many = await Promise.all(["a", "b"].map((value) => subtask(value)))',
      'const chained = await subtask(`follow up on ${first.outputText}`)',
      'log([first, many, chained])',
      'return first.outputText',
    ].join('\n')

    expect(scanForbiddenToken(script)).toBeUndefined()
    expect(checkScript(script).ok).toBe(true)
  })

  it.each([
    ['import . meta', 'import.meta'],
    ['new  Function("return 1")', 'new Function'],
    ['require/*x*/("fs")', 'require('],
    ['import/*x*/("y")', 'import('],
    ['require ("fs")', 'require('],
    ['import ("y")', 'import('],
    ['eval (1)', 'eval('],
    ['fetch (`u`)', 'fetch('],
  ])('flags whitespace/comment-separated %s as %s', (script, token) => {
    expect(scanForbiddenToken(script)).toBe(token)
  })
})

describe('scanForbiddenToken Function constructor bypass', () => {
  it.each([
    ['Function("return process")()', 'Function('],
    ['Function("return globalThis")()', 'Function('],
    ['const f = Function ("return 1")', 'Function('],
    ['const f = Function/*x*/("return 1")', 'Function('],
    ['new Function("x")', 'new Function'],
  ])('flags %s as %s', (script, token) => {
    expect(scanForbiddenToken(script)).toBe(token)
  })

  it.each([
    ['subtask({ prompt: "Function( is not a function" })'],
    ['// Function( is forbidden\nconst value = 1'],
    ['/* Function( inside a comment */ const value = 1'],
    ['const label = `Function( in a template`'],
    ['`value ${ myFunction(1) }`'],
  ])('ignores Function inside literals, templates, and comments: %s', (script) => {
    expect(scanForbiddenToken(script)).toBeUndefined()
  })
})

describe('stripLiteralsAndComments', () => {
  const blanks = (text: string): string => text.replaceAll(/[^\n]/g, ' ')

  it('blanks a line comment but preserves the newline', () => {
    expect(stripLiteralsAndComments('a // b\nc')).toBe(`a ${blanks('// b')}\nc`)
  })

  it('blanks a block comment, including newlines inside it', () => {
    expect(stripLiteralsAndComments('a /* b\nc */ d')).toBe(`a ${blanks('/* b\nc */')} d`)
  })

  it('blanks an unterminated block comment to the end', () => {
    expect(stripLiteralsAndComments('a /* b\nc')).toBe(`a ${blanks('/* b\nc')}`)
  })

  it('blanks a quoted string and respects escaped quotes', () => {
    const input = String.raw`a "b \" c" d`
    expect(stripLiteralsAndComments(input)).toBe(`a ${blanks(String.raw`"b \" c"`)} d`)
  })

  it('blanks a quoted string containing a backslash escape', () => {
    const input = String.raw`a "b \\" c`
    expect(stripLiteralsAndComments(input)).toBe(`a ${blanks(String.raw`"b \\"`)} c`)
  })

  it('blanks an unterminated quoted string at the newline', () => {
    expect(stripLiteralsAndComments('a "b\nc')).toBe(`a ${blanks('"b')}\nc`)
  })

  it('blanks literal template text but keeps interpolation code', () => {
    const stripped = stripLiteralsAndComments('a `b ${ c(1) } d` e')

    expect(stripped).toContain('c(1)')
    expect(stripped).not.toContain('b')
    expect(stripped).not.toContain(' d`')
  })

  it('handles an escaped backtick inside a template literal', () => {
    const stripped = stripLiteralsAndComments('a `b \\` c ${ d(1) }` e')

    expect(stripped).toContain('d(1)')
  })

  it('treats a dollar sign not followed by a brace as template text', () => {
    const stripped = stripLiteralsAndComments('a `price $ b` + c')

    expect(stripped).toContain('+ c')
    expect(stripped).not.toContain('price')
  })

  it('tracks nested braces inside interpolation', () => {
    const stripped = stripLiteralsAndComments('a `${ { x: { y: "b" } } }` + c')

    expect(stripped).toContain('+ c')
    expect(stripped).not.toContain('"b"')
  })

  it('does not close interpolation on a brace inside a nested string', () => {
    const stripped = stripLiteralsAndComments('a `${ fn("}") } b` + c')

    expect(stripped).toContain('fn(')
    expect(stripped).toContain('+ c')
    expect(stripped).not.toContain(' b`')
  })

  it('blanks an unterminated template literal to the end', () => {
    const stripped = stripLiteralsAndComments('a `b ${ c(1) }')

    expect(stripped).toContain('c(1)')
    expect(stripped).not.toContain('b')
  })

  it('leaves ordinary code untouched', () => {
    expect(stripLiteralsAndComments('const value = 1')).toBe('const value = 1')
  })
})

describe('stripLiteralsAndComments exact output', () => {
  const blanks = (text: string): string => text.replaceAll(/[^\n]/g, ' ')

  it('blanks a line comment that runs to the end of input', () => {
    expect(stripLiteralsAndComments('a // b')).toBe(`a ${blanks('// b')}`)
  })

  it('blanks an unterminated quoted string at the end of input', () => {
    expect(stripLiteralsAndComments('a "b')).toBe(`a ${blanks('"b')}`)
  })

  it('blanks a plain template literal and keeps interpolation', () => {
    expect(stripLiteralsAndComments('a `b ${ c(1) } d` e')).toBe('a    ${ c(1) }    e')
  })

  it('preserves newlines inside a template literal', () => {
    expect(stripLiteralsAndComments('a `b\nc` d')).toBe('a   \n   d')
  })

  it('blanks an escaped backtick inside a template literal', () => {
    expect(stripLiteralsAndComments('a `b \\` c` e')).toBe(`a${' '.repeat(10)}e`)
  })

  it('treats a dollar sign without a brace as template text', () => {
    expect(stripLiteralsAndComments('a `price $ b` + c')).toBe(`a${' '.repeat(13)}+ c`)
  })

  it('keeps nested interpolation braces and nested strings', () => {
    const stripped = stripLiteralsAndComments('a `${ { x: { y: "b" } } }` + c')

    expect(stripped).toContain('${')
    expect(stripped).toContain('{ y:')
    expect(stripped).not.toContain('"b"')
    expect(stripped).toContain('+ c')
  })

  it('blanks an unterminated template literal but keeps its interpolation', () => {
    expect(stripLiteralsAndComments('a `b ${ c(1) }')).toBe('a    ${ c(1) }')
  })

  it('does not treat a lone slash as a comment', () => {
    expect(stripLiteralsAndComments('a / b')).toBe('a / b')
    expect(stripLiteralsAndComments('a /x')).toBe('a /x')
  })

  it('does not treat a lone star as a block comment', () => {
    expect(stripLiteralsAndComments('a * b')).toBe('a * b')
  })

  it('keeps every nested interpolation brace', () => {
    expect(stripLiteralsAndComments('a `${ { b: 1 } }` c')).toContain('} }')
  })

  it('never starts interpolation without a brace', () => {
    expect(stripLiteralsAndComments('a `x$y` b')).not.toContain('y')
  })
})

describe('checkScript', () => {
  it('accepts a valid script', () => {
    expect(checkScript('return await subtask("hello")')).toEqual({ ok: true })
  })

  it('rejects a forbidden script with the matched token', () => {
    expect(checkScript('require(\'fs\')')).toEqual({
      ok: false,
      reason: 'forbidden token: require(',
    })
  })

  it('rejects a forbidden token inside template interpolation', () => {
    expect(checkScript('return `${process.exit(1)}`')).toEqual({
      ok: false,
      reason: 'forbidden token: process',
    })
  })

  it.each([
    'const x = ;',
    'const text = "unterminated',
    'const text = `unterminated',
  ])('rejects a syntax error in %s', (script) => {
    const result = checkScript(script)

    expect(result).toEqual(expect.objectContaining({ ok: false, reason: expect.stringMatching(/\S/) }))
  })
})

describe('buildWorkflowFunction', () => {
  it('injects subtask, log and progress into the compiled script', async () => {
    const workflow = buildWorkflowFunction(
      'return [typeof subtask, typeof log, typeof progress, typeof parallel]',
    )
    // A stray `parallel` in helpers must not reach the compiled script.
    const helpersWithExtras = {
      ...createHelpers(),
      parallel: async () => makeResult(),
    } as unknown as WorkflowHelpers

    const result = await workflow(helpersWithExtras)

    expect(result).toEqual(['function', 'function', 'function', 'undefined'])
  })

  it('lets a script await subtask and fan out with Promise.all', async () => {
    const workflow = buildWorkflowFunction(
      'const single = await subtask("hello"); const many = await Promise.all(["a", "b"].map((value) => subtask(value))); return [single.outputText, many.length]',
    )

    const result = await workflow(createHelpers())

    expect(result).toEqual(['hello', 2])
  })

  it('exposes log for observability', async () => {
    const logs: unknown[] = []
    const workflow = buildWorkflowFunction('log("started"); log({ count: 2 }); return "done"')

    const result = await workflow({
      ...createHelpers(),
      log: (message: unknown) => {
        logs.push(message)
      },
    })

    expect(result).toBe('done')
    expect(logs).toEqual(['started', { count: 2 }])
  })

  it('exposes progress so a script can report live status', async () => {
    const progress = vi.fn()
    const workflow = buildWorkflowFunction(
      'progress({ title: "x", metadata: { a: 1 } }); return "done"',
    )

    const result = await workflow({ ...createHelpers(), progress })

    expect(result).toBe('done')
    expect(progress).toHaveBeenCalledWith({ title: 'x', metadata: { a: 1 } })
  })

  it('rejects when the script throws', async () => {
    const workflow = buildWorkflowFunction('throw new Error("boom")')

    await expect(workflow(createHelpers())).rejects.toThrow('boom')
  })
})
