import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GateConfig } from '@plugins/types/quality-gate'
import { createDirtyGateBatcher, runGate, type CommandResult, type Shell } from '@plugins/helpers/gate-runner'

function makeTemplateArray(command: string): TemplateStringsArray {
  return Object.assign([command], { raw: [command] })
}

function createNoQuietShellPromise(output: CommandResult): ReturnType<Shell> {
  const resolved = {
    ...output,
    stdout: typeof output.stdout === 'string' ? Buffer.from(output.stdout) : output.stdout,
    stderr: typeof output.stderr === 'string' ? Buffer.from(output.stderr) : output.stderr,
    text: async () => String(output.stdout),
  }
  const promise = Promise.resolve(resolved) as ReturnType<Shell>
  promise.nothrow = () => promise
  return promise
}

function createNoQuietShellMock(output: CommandResult): Shell {
  return vi.fn().mockImplementation(() => createNoQuietShellPromise(output)) as Shell
}

function createShellPromise(output: CommandResult): ReturnType<Shell> {
  const resolved = {
    ...output,
    stdout: typeof output.stdout === 'string' ? Buffer.from(output.stdout) : output.stdout,
    stderr: typeof output.stderr === 'string' ? Buffer.from(output.stderr) : output.stderr,
    text: async () => String(output.stdout),
  }
  const promise = Promise.resolve(resolved) as ReturnType<Shell>
  promise.nothrow = () => promise
  promise.quiet = () => promise
  return promise
}

function createShellSequenceMock(outputs: CommandResult[]): Shell {
  const queue = [...outputs]
  return vi.fn().mockImplementation(() => {
    const next = queue.shift() ?? { exitCode: 0, stdout: '', stderr: '' }
    return createShellPromise(next)
  }) as Shell
}

function makeGate(name: string, commands: string[]): GateConfig {
  return { name, patterns: ['**/*.ts'], commands }
}

describe('runGate', () => {
  it('passes all commands and returns exitCode 0 with combined output', async () => {
    const gate = makeGate('lint', ['echo a', 'echo b'])
    const shell = createShellSequenceMock([
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
    const gate = makeGate('test', ['echo ok', 'exit 1', 'echo skipped'])
    const shell = createShellSequenceMock([
      { exitCode: 0, stdout: 'ok\n', stderr: '' },
      { exitCode: 1, stdout: '', stderr: 'failed\n' },
      { exitCode: 0, stdout: 'skipped\n', stderr: '' },
    ])

    const result = await runGate(gate, shell)

    expect(result).toEqual({ exitCode: 1, stdout: '', stderr: 'failed\n' })
    expect(shell).toHaveBeenCalledTimes(2)
  })

  it('works when shell does not support quiet', async () => {
    const gate = makeGate('lint', ['echo ok'])
    const shell = createNoQuietShellMock({ exitCode: 0, stdout: 'ok\n', stderr: '' })

    const result = await runGate(gate, shell)

    expect(result).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })
    expect(shell).toHaveBeenCalledTimes(1)
  })

  it('returns empty string for undefined stderr', async () => {
    const gate = makeGate('lint', ['cmd'])
    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0,
        stdout: Buffer.from('ok\n'),
        stderr: undefined,
        text: vi.fn().mockResolvedValue('ok\n'),
      }
      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>
      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)
    expect(result.stderr).toBe('')
  })

  it('returns plain string stderr as-is without buffer conversion', async () => {
    const gate = makeGate('lint', ['cmd'])
    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0,
        stdout: Buffer.from('ok\n'),
        stderr: 'raw-string-stderr',
        text: vi.fn().mockResolvedValue('ok\n'),
      }
      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>
      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)
    expect(result.stderr).toBe('raw-string-stderr')
  })

  it('calls quiet() on shell output when available', async () => {
    const gate = makeGate('lint', ['cmd'])
    const quietFunction = vi.fn()
    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0,
        stdout: Buffer.from('ok\n'),
        stderr: Buffer.from(''),
        text: vi.fn().mockResolvedValue('ok\n'),
      }
      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>
      promise.nothrow = () => promise
      promise.quiet = quietFunction.mockReturnValue(promise)
      return promise
    }) as unknown as Shell

    await runGate(gate, shell)
    expect(quietFunction).toHaveBeenCalled()
  })

  it('calls nothrow() on shell output when available', async () => {
    const gate = makeGate('lint', ['cmd'])
    const nothrowFunction = vi.fn()
    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0,
        stdout: Buffer.from('ok\n'),
        stderr: Buffer.from(''),
        text: vi.fn().mockResolvedValue('ok\n'),
      }
      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>
      promise.nothrow = nothrowFunction.mockReturnValue(promise)
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    await runGate(gate, shell)
    expect(nothrowFunction).toHaveBeenCalled()
  })

  it('works when shell does not support nothrow', async () => {
    const gate = makeGate('lint', ['cmd'])
    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0,
        stdout: Buffer.from('ok\n'),
        stderr: Buffer.from(''),
        text: vi.fn().mockResolvedValue('ok\n'),
      }
      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>
      // no nothrow property set
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)
    expect(result).toEqual({ exitCode: 0, stdout: 'ok\n', stderr: '' })
  })

  it('uses .text() for stdout when available on ShellOutput', async () => {
    const gate = makeGate('test', ['noisy-command'])
    // Simulate a ShellOutput that has .text() returning different (cleaner) output
    // than the raw stdout Buffer — this proves runGate prefers the official API.
    const shell = vi.fn().mockImplementation(() => {
      const output = {
        exitCode: 0,
        stdout: Buffer.from('raw-buffer-output'),
        stderr: Buffer.from(''),
        text: vi.fn().mockResolvedValue('clean-text-output'),
      }
      const promise = Promise.resolve(output) as unknown as ReturnType<Shell>
      promise.nothrow = () => promise
      promise.quiet = () => promise
      return promise
    }) as unknown as Shell

    const result = await runGate(gate, shell)

    // Should use .text() output, not raw stdout Buffer
    expect(result.stdout).toBe('clean-text-output')
  })
})

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

    // At t=60 (50+10), the original timer would have fired at t=100 if not reset.
    // Since the second mark at t=50 should reset the timer, it should fire at t=150.
    // Advancing to t=110 (50+60) should NOT trigger the callback.
    vi.advanceTimersByTime(60)

    expect(onBatch).not.toHaveBeenCalled()

    // Now advance past the reset deadline (t=150)
    vi.advanceTimersByTime(50)

    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch).toHaveBeenCalledWith(['lint', 'typecheck'])
  })

  it('no callback when no gates marked', () => {
    const onBatch = vi.fn()
    createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    vi.advanceTimersByTime(200)

    expect(onBatch).not.toHaveBeenCalled()
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

  it('mark after dispose is no-op', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.dispose()
    batcher.markDirty(['lint'])

    vi.advanceTimersByTime(100)

    expect(onBatch).not.toHaveBeenCalled()
  })

  it('single-flight: edit during flush re-arms timer after batch completes', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    onBatch.mockImplementation((_gates: string[]) => {
      batcher.markDirty(['lint'])
    })

    batcher.markDirty(['lint'])

    // First flush: onBatch fires, inside it markDirty is called again
    vi.advanceTimersByTime(100)

    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch).toHaveBeenCalledWith(['lint'])

    // Second flush after re-armed timer
    vi.advanceTimersByTime(100)

    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenNthCalledWith(2, ['lint'])
  })

  it('resets isFlushing after timer callback, allowing new marks to start timer', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    // First batch: fire timer
    batcher.markDirty(['lint'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(1)

    // After timer callback, isFlushing should be false.
    // A new mark should start a fresh timer.
    batcher.markDirty(['typecheck'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenLastCalledWith(['typecheck'])
  })

  it('during timer onBatch, new dirty marks defer to post-batch timer', () => {
    const callOrder: string[] = []
    const batcher = createDirtyGateBatcher({
      maxQuietMs: 100,
      onBatch: (gates) => {
        callOrder.push(`batch:${gates.join(',')}`)
        // markDirty during onBatch — isFlushing guard (line 134) prevents
        // startTimer from running here. The post-batch check (dirty.size > 0)
        // handles re-arming instead.
        batcher.markDirty(['late'])
        callOrder.push('after-mark')
      },
    })

    batcher.markDirty(['early'])
    vi.advanceTimersByTime(100)

    // First batch fired synchronously. markDirty during onBatch did NOT
    // trigger startTimer — it deferred to the post-batch check.
    expect(callOrder).toEqual(['batch:early', 'after-mark'])

    // Second batch fires after re-armed timer from post-batch check
    vi.advanceTimersByTime(100)
    expect(callOrder).toEqual(['batch:early', 'after-mark', 'batch:late', 'after-mark'])
  })

  it('does not restart timer when dirty set is empty after batch completes', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(1)

    // No new marks during onBatch — dirty is empty. Timer should not re-arm.
    vi.advanceTimersByTime(200)
    expect(onBatch).toHaveBeenCalledTimes(1)
  })

  it('resets isFlushing after flush, allowing subsequent marks to start timer', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    batcher.flush()
    expect(onBatch).toHaveBeenCalledTimes(1)

    // After flush, isFlushing should be false.
    // A new mark should start a fresh timer.
    batcher.markDirty(['typecheck'])
    vi.advanceTimersByTime(100)
    expect(onBatch).toHaveBeenCalledTimes(2)
    expect(onBatch).toHaveBeenLastCalledWith(['typecheck'])
  })

  it('flush does not restart timer when dirty set is empty after batch', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    batcher.markDirty(['lint'])
    batcher.flush()
    expect(onBatch).toHaveBeenCalledTimes(1)

    // No new marks during onBatch — dirty is empty. Timer should not re-arm.
    vi.advanceTimersByTime(200)
    expect(onBatch).toHaveBeenCalledTimes(1)
  })

  it('dispose() on a batcher that never started a timer does not throw', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    // cancelTimer is called with timer === undefined — the guard at line 99
    // prevents clearTimeout(undefined). Even without the guard, clearTimeout(undefined)
    // is a no-op per spec, so the behavior is correct either way.
    expect(() => batcher.dispose()).not.toThrow()
    expect(onBatch).not.toHaveBeenCalled()
  })

  it('flush() on a batcher that never started a timer is a no-op', () => {
    const onBatch = vi.fn()
    const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

    // flush early-returns when dirty.size === 0, but we also want to verify
    // that startTimer() (called via markDirty path) handles cancelTimer
    // when no prior timer was set.
    batcher.flush()
    expect(onBatch).not.toHaveBeenCalled()
  })

  describe('adaptive timer', () => {
    it('falls back to maxQuietMs when adaptive delay is zero', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })

      const nowValue = 1000
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValue)

      // Two edits at the same faked timestamp → adaptive = 0 → fallback to maxQuietMs
      batcher.markDirty(['lint'])
      batcher.markDirty(['typecheck'])

      vi.advanceTimersByTime(499)
      expect(onBatch).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['lint', 'typecheck'])

      nowSpy.mockRestore()
    })

    it('computes adaptive delay with exactly two spaced edits', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })

      let nowValue = 1000
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValue)

      batcher.markDirty(['lint'])
      nowValue = 1100
      batcher.markDirty(['typecheck'])
      // Adaptive = 2 * (100ms gap) = 200ms from second edit

      vi.advanceTimersByTime(199)
      expect(onBatch).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['lint', 'typecheck'])

      nowSpy.mockRestore()
    })

    it('computes adaptive delay with three spaced edits', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })

      let nowValue = 1000
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValue)

      batcher.markDirty(['a'])
      nowValue = 1050
      batcher.markDirty(['b'])
      nowValue = 1100
      batcher.markDirty(['c'])
      // Three edits 50ms apart: avg gap = 50ms, adaptive = 2 * 50 = 100ms

      vi.advanceTimersByTime(100)
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['a', 'b', 'c'])

      nowSpy.mockRestore()
    })

    it('trims editTimestamps to last 10 entries for adaptive calculation', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 500, onBatch })

      let nowValue = 1000
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValue)

      // Make 12 edits, each 10ms apart. After the 10th edit, the sliding
      // window trims old entries so only the last 10 timestamps remain.
      for (let index = 0; index < 12; index++) {
        nowValue = 1000 + index * 10
        batcher.markDirty([`gate-${index}`])
      }

      // After 12 edits at t=1110, only last 10 timestamps [1020..1110] remain.
      // Gaps: 9 intervals of 10ms → avg = 10ms → adaptive = 20ms from t=1110.
      // Timer should fire 20ms after the last markDirty call.

      // At 19ms past the last edit, timer hasn't fired yet
      vi.advanceTimersByTime(19)
      expect(onBatch).not.toHaveBeenCalled()

      // At 20ms, timer fires
      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(1)
      // Only the most recent dirty gates from the last reset should batch
      expect(onBatch).toHaveBeenCalledWith(
        expect.arrayContaining(['gate-11'])
      )

      nowSpy.mockRestore()
    })

    it('caps adaptive delay at maxQuietMs', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      let nowValue = 1000
      const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => nowValue)

      // First edit
      batcher.markDirty(['lint'])
      // Timer set for 100ms (maxQuietMs, only 1 edit)

      // Advance 100ms for the first timer to fire
      vi.advanceTimersByTime(100)
      // First batch fires
      expect(onBatch).toHaveBeenCalledTimes(1)

      // Now make two spaced edits (far apart) — adaptive > maxQuietMs, should cap
      batcher.markDirty(['a'])
      nowValue = 1200
      batcher.markDirty(['b'])
      // Adaptive = 2 * 200 = 400, capped at maxQuietMs=100

      vi.advanceTimersByTime(99)
      expect(onBatch).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(1)
      expect(onBatch).toHaveBeenCalledTimes(2)
      expect(onBatch).toHaveBeenLastCalledWith(['a', 'b'])

      nowSpy.mockRestore()
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

    it('does nothing when dirty set is empty', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      batcher.flush()

      expect(onBatch).not.toHaveBeenCalled()
    })

    it('does nothing on disposed batcher', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      batcher.markDirty(['lint'])
      batcher.dispose()
      batcher.flush()

      expect(onBatch).not.toHaveBeenCalled()
    })

    it('restarts timer if new dirty marks arrive during flush', () => {
      const onBatch = vi.fn()
      const batcher = createDirtyGateBatcher({ maxQuietMs: 100, onBatch })

      onBatch.mockImplementation(() => {
        batcher.markDirty(['typecheck'])
      })

      batcher.markDirty(['lint'])
      batcher.flush()

      // Flush called onBatch with ['lint']; inside it, typecheck was marked dirty
      expect(onBatch).toHaveBeenCalledTimes(1)
      expect(onBatch).toHaveBeenCalledWith(['lint'])

      // The re-armed timer should fire for ['typecheck']
      vi.advanceTimersByTime(100)

      expect(onBatch).toHaveBeenCalledTimes(2)
      expect(onBatch).toHaveBeenNthCalledWith(2, ['typecheck'])
    })
  })
})
