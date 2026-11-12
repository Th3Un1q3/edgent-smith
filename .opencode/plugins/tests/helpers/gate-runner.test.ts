import { describe, expect, it, vi } from 'vitest'

import type { GateConfig } from '@plugins/types/quality-gate'

import { runGate, type CommandResult, type Shell } from '@plugins/helpers/gate-runner'

const makeTemplateArray = (command: string): TemplateStringsArray => {
  return Object.assign([command], { raw: [command] })
}

const createShellPromise = (
  output: CommandResult,
  options?: { quiet?: boolean, nothrow?: boolean },
): ReturnType<Shell> => {
  const { quiet = true, nothrow = true } = options ?? {}

  const resolved = {
    ...output,
    stdout: typeof output.stdout === 'string' ? Buffer.from(output.stdout) : output.stdout,
    stderr: typeof output.stderr === 'string' ? Buffer.from(output.stderr) : output.stderr,
    text: async () => String(output.stdout),
  }

  const promise = Promise.resolve(resolved) as ReturnType<Shell>
  if (nothrow) promise.nothrow = () => promise
  if (quiet) promise.quiet = () => promise
  return promise
}

const createShellMock = (outputs: CommandResult[]): Shell => {
  const queue = [...outputs]
  return vi.fn().mockImplementation(() =>
    createShellPromise(queue.shift() ?? { exitCode: 0, stdout: '', stderr: '' }),
  ) as Shell
}

type ShellFunction = () => ReturnType<Shell>

const createSpyShell = (
  output: CommandResult,
  spies: { quiet?: ShellFunction, nothrow?: ShellFunction },
): Shell => {
  return vi.fn().mockImplementation(() => {
    const promise = createShellPromise(output, { quiet: false, nothrow: false }) as ReturnType<Shell>
    if (spies.quiet) promise.quiet = spies.quiet
    if (spies.nothrow) promise.nothrow = spies.nothrow
    return promise
  }) as Shell
}

const makeGate = ({ name, commands }: { name: string, commands: string[] }): GateConfig => {
  return { name, patterns: ['**/*.ts'], commands }
}

// ─── runGate ─────────────────────────────────────────────────

describe('runGate', () => {
  it('passes all commands and returns exitCode 0 with combined output', async () => {
    const gate = makeGate({ name: 'lint', commands: ['echo a', 'echo b'] })

    const shell = createShellMock([
      { exitCode: 0, stdout: 'a\n', stderr: '' },
      { exitCode: 0, stdout: 'b\n', stderr: '' },
    ])

    const result = await runGate(gate, shell)

    expect(result).toEqual({ exitCode: 0, stdout: 'a\nb\n', stderr: '' })
    expect(shell).toHaveBeenCalledTimes(2)
    expect(shell).toHaveBeenNthCalledWith(1, makeTemplateArray('echo a'))
    expect(shell).toHaveBeenNthCalledWith(2, makeTemplateArray('echo b'))
  })

  it('stops at first failing command and returns its result', async () => {
    const gate = makeGate({ name: 'test', commands: ['echo ok', 'exit 1', 'echo skipped'] })

    const shell = createShellMock([
      { exitCode: 0, stdout: 'ok\n', stderr: '' },
      { exitCode: 1, stdout: '', stderr: 'failed\n' },
      { exitCode: 0, stdout: 'skipped\n', stderr: '' },
    ])

    const result = await runGate(gate, shell)

    expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'failed\n' })
    expect(shell).toHaveBeenCalledTimes(2)
  })

  it.each([
    { label: 'quiet', setup: (output: CommandResult) => createShellMock([output]) },
    { label: 'nothrow', setup: (output: CommandResult) => {
      const shellPromise = createShellPromise(output)

      const promise = Promise.resolve(shellPromise) as ReturnType<Shell>

      promise.quiet = () => promise
      return vi.fn().mockImplementation(() => promise) as Shell
    } },
  ])('works when shell lacks $label', async ({ setup }) => {
    const gate = makeGate({ name: 'lint', commands: ['echo ok'] })

    const shell = setup({ exitCode: 0, stdout: 'ok\n', stderr: '' })

    const result = await runGate(gate, shell)

    expect(result).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })
    expect(shell).toHaveBeenCalledTimes(1)
  })

  it.each([
    { label: 'undefined stderr', stderr: undefined as string | Buffer | undefined, expected: '' },
    { label: 'string stderr', stderr: 'raw-string-stderr' as string | Buffer | undefined, expected: 'raw-string-stderr' },
  ])('handles $label', async ({ stderr, expected }) => {
    const gate = makeGate({ name: 'lint', commands: ['cmd'] })

    const shell = vi.fn().mockImplementation(() => {
      const output = { exitCode: 0, stdout: Buffer.from('ok\n'), stderr, text: vi.fn().mockResolvedValue('ok\n') }

      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>

      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)

    expect(result.stderr).toBe(expected)
  })

  it.each([
    { label: 'quiet', method: 'quiet' as const },
    { label: 'nothrow', method: 'nothrow' as const },
  ])('calls $method() on shell output when available', async ({ method }) => {
    const gate = makeGate({ name: 'lint', commands: ['cmd'] })

    const spy = vi.fn()

    const shell = createSpyShell(
      { exitCode: 0, stdout: 'ok\n', stderr: '' },
      { [method]: spy.mockReturnValue(createShellPromise({ exitCode: 0, stdout: 'ok\n', stderr: '' })) },
    )

    await runGate(gate, shell)
    expect(spy).toHaveBeenCalled()
  })

  it('uses .text() for stdout when available on ShellOutput', async () => {
    const gate = makeGate({ name: 'test', commands: ['noisy-command'] })

    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0, stdout: Buffer.from('raw-buffer-output'), stderr: Buffer.from(''),
        text: vi.fn().mockResolvedValue('clean-text-output'),
      }

      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>

      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)

    expect(result.stdout).toBe('clean-text-output')
  })

  it('returns non-Buffer non-string stderr object as-is without calling toString on non-fatal path', async () => {
    const gate = makeGate({ name: 'lint', commands: ['cmd'] })

    const customStderr = { toString: () => 'should-not-be-called' }

    const shell = vi.fn().mockImplementation(() => {
      const output = { exitCode: 1, stdout: Buffer.from(''), stderr: customStderr, text: vi.fn().mockResolvedValue('') }

      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>

      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)

    // Mutant #1: Buffer.isBuffer always true → toString() → returns string instead of object
    expect(result.stderr).toBe(customStderr)
  })

  // ─── timeouts ──────────────────────────────────────────────

  it('wraps a command with a hard timeout when gate.timeoutMs is set', async () => {
    const gate: GateConfig = { name: 'test', patterns: ['**/*.ts'], commands: ['sleep 10'], timeoutMs: 300_000 }

    const shell = createShellMock([{ exitCode: 0, stdout: 'ok\n', stderr: '' }])

    const result = await runGate(gate, shell)

    expect(result).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })
    expect(shell).toHaveBeenCalledWith(makeTemplateArray('timeout -k 5s 300s bash -c \'sleep 10\''))
  })

  it('terminates a command that exceeds timeoutMs and reports a timedOut failure', async () => {
    const gate: GateConfig = { name: 'test', patterns: ['**/*.ts'], commands: ['hang'], timeoutMs: 20 }

    const shell = vi.fn().mockImplementation(() => {
      const promise = new Promise(() => {}) as unknown as ReturnType<Shell>

      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)

    expect(result.exitCode).toBe(124)
    expect(result.timedOut).toBe(true)
    expect(result.stderr).toContain('timed out')
  })

  it('marks CLI timeout exit code 124 as timedOut with a clear message', async () => {
    const gate: GateConfig = { name: 'test', patterns: ['**/*.ts'], commands: ['slow'], timeoutMs: 300_000 }

    const shell = createShellMock([{ exitCode: 124, stdout: 'partial\n', stderr: '' }])

    const result = await runGate(gate, shell)

    expect(result.exitCode).toBe(124)
    expect(result.timedOut).toBe(true)
    expect(result.stderr).toContain('timed out')
  })
})
