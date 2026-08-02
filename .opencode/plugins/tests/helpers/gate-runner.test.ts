import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GateConfig } from '@plugins/types/quality-gate'

import { createDirtyGateBatcher, runGate, type CommandResult, type Shell } from '@plugins/helpers/gate-runner'

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
})

// ─── DirtyGateBatcher ────────────────────────────────────────

describe('DirtyGateBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('marks gates dirty and fires callback after quiet period', () => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    expect(onBatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch).toHaveBeenCalledWith(['lint'])
  })

  it('reset timer on second mark before quiet', () => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    vi.advanceTimersByTime(50)
    batcher.markDirty(['typecheck'])
    expect(onBatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(onBatch).not.toHaveBeenCalled()
    vi.advanceTimersByTime(50)
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch).toHaveBeenCalledWith(['lint', 'typecheck'])
  })

  it('dispose cancels pending timer', () => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    batcher.dispose()
    vi.advanceTimersByTime(100)
    expect(onBatch).not.toHaveBeenCalled()
  })

  it('multiple names in single mark', () => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint', 'typecheck', 'test'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch).toHaveBeenCalledWith(['lint', 'typecheck', 'test'])
  })

  it('single-flight: edit during flush re-arms timer after batch completes', () => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    onBatch.mockImplementation((_gates: string[]) => {
      batcher.markDirty(['lint'])
    })
    batcher.markDirty(['lint'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch).toHaveBeenCalledWith(['lint'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenNthCalledWith(2, ['lint'])
  })

  it('during timer onBatch, new dirty marks defer to post-batch timer', () => {
    const callOrder: string[] = []

    const batcher = createDirtyGateBatcher({
      maxQuietMs: 100,
      onBatch: (gates) => {
        callOrder.push(`batch:${gates.join(',')}`)
        batcher.markDirty(['late'])
        callOrder.push('after-mark')
      },
    })

    batcher.markDirty(['early'])
    vi.advanceTimersByTime(100)
    expect(callOrder).toEqual(['batch:early', 'after-mark'])
    vi.advanceTimersByTime(100)
    expect(callOrder).toEqual(['batch:early', 'after-mark', 'batch:late', 'after-mark'])
  })

  it('cancelTimer does not call clearTimeout when timer is already undefined', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')

    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    // Mutants #2/#3: removing guard → clearTimeout(undefined) called
    batcher.dispose()
    expect(clearTimeoutSpy).not.toHaveBeenCalled()
  })

  it('isFlushing guard in timer callback prevents extra timer creation', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    onBatch.mockImplementation(() => {
      batcher.markDirty(['typecheck'])
    })
    batcher.markDirty(['lint'])
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(100)
    // Mutants #4/#7: isFlushing not guarding → 3rd setTimeout call
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2)
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenNthCalledWith(2, ['typecheck'])
  })

  it.each([
    { label: 'no marks → no callback', run: (_b: ReturnType<typeof createDirtyGateBatcher>) => vi.advanceTimersByTime(200) },
    { label: 'dispose before marks → no throw', run: (b: ReturnType<typeof createDirtyGateBatcher>) => b.dispose() },
    { label: 'flush before marks → no-op', run: (b: ReturnType<typeof createDirtyGateBatcher>) => b.flush() },
  ])('handles edge cases: $label', ({ run }) => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    run(batcher)
    expect(onBatch).not.toHaveBeenCalled()
  })

  it.each([
    { label: 'after timer callback', trigger: (_b: ReturnType<typeof createDirtyGateBatcher>) => vi.advanceTimersByTime(100) },
    { label: 'after flush()', trigger: (b: ReturnType<typeof createDirtyGateBatcher>) => b.flush() },
  ])('isFlushing resets after batch completes — $label', ({ trigger }) => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    trigger(batcher)
    expect(onBatch).toHaveBeenCalledTimes(1)
    batcher.markDirty(['typecheck'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenLastCalledWith(['typecheck'])
  })

  it.each([
    { label: 'after timer callback', trigger: (_b: ReturnType<typeof createDirtyGateBatcher>) => vi.advanceTimersByTime(100) },
    { label: 'after flush()', trigger: (b: ReturnType<typeof createDirtyGateBatcher>) => b.flush() },
  ])('does not re-arm timer when dirty set is empty after batch — $label', ({ trigger }) => {
    const onBatch = vi.fn()

    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    trigger(batcher)
    expect(onBatch).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(200)
    expect(onBatch).toHaveBeenCalledTimes(1)
  })

  describe('adaptive timer', () => {
    it('falls back to maxQuietMs when adaptive delay is zero', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })

      const nowValue = 1000

      vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
      batcher.markDirty(['lint'])
      batcher.markDirty(['typecheck'])
      vi.advanceTimersByTime(499)
      expect(onBatch).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['lint', 'typecheck'])
    })

    it('caps adaptive delay at maxQuietMs', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })
      let nowValue = 1000
      vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
      batcher.markDirty(['lint'])
      vi.advanceTimersByTime(100)
      expect(onBatch).toHaveBeenCalledTimes(1)
      batcher.markDirty(['a'])
      nowValue = 1200
      batcher.markDirty(['b'])
      vi.advanceTimersByTime(99)
      expect(onBatch).toHaveBeenCalledTimes(1)
      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(2)
      expect(onBatch).toHaveBeenLastCalledWith(['a', 'b'])
    })

    it.each([
      { label: 'two edits 100ms apart → 200ms delay', edits: [{ t: 1000, gates: ['lint'] }, { t: 1100, gates: ['typecheck'] }], expectDelay: 200 },
      { label: 'three edits 50ms apart → 100ms delay', edits: [{ t: 1000, gates: ['a'] }, { t: 1050, gates: ['b'] }, { t: 1100, gates: ['c'] }], expectDelay: 100 },
    ])('computes adaptive delay: $label', ({ edits, expectDelay }) => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })
      let nowValue = edits[0].t
      vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
      for (const edit of edits) {
        nowValue = edit.t
        batcher.markDirty(edit.gates)
      }
      vi.advanceTimersByTime(expectDelay - 1)
      expect(onBatch).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(edits.flatMap(edit => edit.gates))
    })

    it('trims editTimestamps to last 10 entries for adaptive calculation', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })
      let nowValue = 1000
      vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
      for (let index = 0; index < 12; index++) {
        nowValue = 1000 + index * 10
        batcher.markDirty([`gate-${index}`])
      }
      // After 12 edits at 10ms gaps, last 10 timestamps → avg=10ms → adaptive=20ms
      vi.advanceTimersByTime(19)
      expect(onBatch).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(expect.arrayContaining(['gate-11']))
    })

    it('shifts editTimestamps when length exceeds 10 to prevent stale entry skew', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })
      let nowValue = 0
      vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
      // 12 edits: first two far apart, remaining 10 close (1ms gaps)
      nowValue = 0
      batcher.markDirty(['g1'])
      nowValue = 100
      batcher.markDirty(['g2'])
      for (let index = 0; index < 10; index++) {
        nowValue = 101 + index
        batcher.markDirty([`g${index + 3}`])
      }
      // Mutant #5: never shifts → 100ms gap inflates avg → fires later than 2ms
      vi.advanceTimersByTime(2)
      expect(onBatch).toHaveBeenCalledTimes(1)
    })

    it('does not shift editTimestamps at exactly 10 entries', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })
      let nowValue = 0
      vi.spyOn(Date, 'now').mockImplementation(() => nowValue)
      // 10 edits: first gap large, rest 1ms — no shift at length=10 (>10 threshold)
      nowValue = 0
      batcher.markDirty(['g1'])
      nowValue = 100
      batcher.markDirty(['g2'])
      for (let index = 0; index < 8; index++) {
        nowValue = 101 + index
        batcher.markDirty([`g${index + 3}`])
      }
      // Mutant #6: shift at >=10 → adaptive=2ms → fires at 2ms (should not)
      vi.advanceTimersByTime(2)
      expect(onBatch).not.toHaveBeenCalled()
      vi.advanceTimersByTime(22)
      expect(onBatch).toHaveBeenCalledTimes(1)
    })
  })

  describe('flush', () => {
    it('runs callback immediately without waiting for timer', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      batcher.markDirty(['lint'])
      batcher.flush()
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['lint'])
    })

    it('restarts timer if new dirty marks arrive during flush', () => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      onBatch.mockImplementation(() => {
        batcher.markDirty(['typecheck'])
      })
      batcher.markDirty(['lint'])
      batcher.flush()
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['lint'])
      vi.advanceTimersByTime(100)
      expect(onBatch).toHaveBeenCalledTimes(2)
      expect(onBatch).toHaveBeenNthCalledWith(2, ['typecheck'])
    })

    it('isFlushing guard in flush prevents extra timer creation', () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      onBatch.mockImplementation(() => {
        batcher.markDirty(['typecheck'])
      })
      batcher.markDirty(['lint'])
      expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
      batcher.flush()
      // Mutant #8: isFlushing not guarding → 3rd setTimeout call
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2)
      vi.advanceTimersByTime(100)
      expect(onBatch).toHaveBeenCalledTimes(2)
      expect(onBatch).toHaveBeenNthCalledWith(2, ['typecheck'])
    })

    it.each([
      { label: 'dirty set is empty', markDirty: false },
      { label: 'batcher is disposed', markDirty: true },
    ])('flush is no-op when $label', ({ markDirty: shouldMark }) => {
      const onBatch = vi.fn()

      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })
      if (shouldMark) {
        batcher.markDirty(['lint'])
        batcher.dispose()
      }
      batcher.flush()
      expect(onBatch).not.toHaveBeenCalled()
    })
  })
})
