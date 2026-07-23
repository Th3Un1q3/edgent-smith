import type { GateConfig } from '@plugins/types/quality-gate'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface ShellOutput {
  exitCode: number
  stdout: string | Buffer
  stderr: string | Buffer
  text(): Promise<string>
  json(): Promise<unknown>
}

export type ShellPromise = Promise<ShellOutput> & {
  nothrow(): ShellPromise
  quiet(): ShellPromise
}

export type Shell = (strings: TemplateStringsArray, ...values: unknown[]) => ShellPromise

function toStringOutput(value: string | Buffer | undefined): string {
  if (value === undefined) {
    return ''
  }
  if (Buffer.isBuffer(value)) {
    return value.toString()
  }
  return value
}

function makeTemplateArray(command: string): TemplateStringsArray {
  return Object.assign([command], { raw: [command] })
}

export async function runGate(gate: GateConfig, shell: Shell): Promise<CommandResult> {
  let combinedStdout = ''
  let combinedStderr = ''

  for (const command of gate.commands) {
    const template = makeTemplateArray(command)
    const rawInvocation = shell(template)
    let invocation: ShellPromise

    invocation = typeof rawInvocation.quiet === 'function' ? rawInvocation.quiet() : (rawInvocation as ShellPromise);

    if (typeof invocation.nothrow === 'function') {
      invocation = invocation.nothrow()
    }
    const output = await invocation

    const stdout = await output.text()
    const stderr = toStringOutput(output.stderr)

    if (output.exitCode !== 0) {
      return { exitCode: output.exitCode, stdout, stderr }
    }

    combinedStdout += stdout
    combinedStderr += stderr
  }

  return { exitCode: 0, stdout: combinedStdout, stderr: combinedStderr }
}

export interface DirtyGateBatcher {
  markDirty(gateNames: string[]): void
  flush(): void
  dispose(): void
}

export function createDirtyGateBatcher(parameters: {
  maxQuietMs: number
  onBatch: (dirtyGates: string[]) => void
}): DirtyGateBatcher {
  const { maxQuietMs, onBatch } = parameters
  const dirty = new Set<string>()
  let isDisposed = false
  let isFlushing = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const editTimestamps: number[] = []

  function getAdaptiveQuietMs(): number {
    if (editTimestamps.length < 2) return maxQuietMs
    let total = 0
    for (let index = 1; index < editTimestamps.length; index++) {
      total += editTimestamps[index] - editTimestamps[index - 1]
    }
    const avg = total / (editTimestamps.length - 1)
    const adaptive = 2 * avg
    if (adaptive <= 0) return maxQuietMs
    return Math.min(adaptive, maxQuietMs)
  }

  function cancelTimer(): void {
    if (timer === undefined) {
      return;
    }

    clearTimeout(timer)
    timer = undefined
  }

  function startTimer(): void {
    cancelTimer()
    const delay = getAdaptiveQuietMs()
    timer = setTimeout(() => {
      timer = undefined
      isFlushing = true
      const snapshot = [...dirty]
      dirty.clear()
      onBatch(snapshot)
      isFlushing = false
      if (dirty.size > 0) {
        startTimer()
      }
    }, delay)
  }

  return {
    markDirty(gateNames: string[]): void {
      if (isDisposed) return
      for (const name of gateNames) {
        dirty.add(name)
      }
      editTimestamps.push(Date.now())
      if (editTimestamps.length > 10) editTimestamps.shift()
      if (!isFlushing) {
        startTimer()
      }
    },
    flush(): void {
      if (isDisposed || dirty.size === 0) return
      cancelTimer()
      isFlushing = true
      const snapshot = [...dirty]
      dirty.clear()
      onBatch(snapshot)
      isFlushing = false
      if (dirty.size > 0) {
        startTimer()
      }
    },
    dispose(): void {
      cancelTimer()
      dirty.clear()
      isDisposed = true
    },
  }
}
