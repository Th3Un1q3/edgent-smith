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
