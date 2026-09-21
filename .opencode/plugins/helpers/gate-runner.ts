import type { GateConfig } from '../types/quality-gate'

export interface CommandResult {
  exitCode: number
  stdout: string
  stderr: string
  /**
  Set when the command was killed because it exceeded its gate timeout.
  */
  timedOut?: boolean
}

/**
Exit code produced by coreutils `timeout` when the command times out.
*/
const TIMEOUT_EXIT_CODE = 124
/**
Grace period for `timeout -k` to SIGKILL a process that ignores SIGTERM.
*/
const TIMEOUT_KILL_GRACE = '5s'

/**
POSIX single-quote a value so it survives being embedded in a shell command.
*/
export function quoteShellArgument(value: string): string {
  return `'${value.replaceAll('\'', String.raw`'\''`)}'`
}

/**
 * Wrap a gate command so it is hard-killed after `timeoutMs` even if it spins
 * forever. `timeout -k` guarantees a follow-up SIGKILL; running under `bash -c`
 * preserves the original command's shell semantics (`&&`, `$(...)`, quotes).
 */
export function applyCommandTimeout(command: string, timeoutMs: number): string {
  const seconds = Math.max(1, Math.ceil(timeoutMs / 1000))
  return `timeout -k ${TIMEOUT_KILL_GRACE} ${seconds}s bash -c ${quoteShellArgument(command)}`
}

const TIMED_OUT = Symbol('gate-command-timed-out')

/**
 * Race the shell invocation against a timer. This is the safety net that makes
 * `runGate` settle even when the shell/process ignores the CLI `timeout` kill
 * (or is a test double that never resolves).
 */
async function awaitWithTimeout(
  invocation: ShellPromise,
  timeoutMs: number | undefined,
): Promise<ShellOutput | typeof TIMED_OUT> {
  if (timeoutMs === undefined) {
    return invocation
  }

  let timer: ReturnType<typeof setTimeout> | undefined

  const guard = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), timeoutMs)
  })

  try {
    return await Promise.race([invocation, guard])
  }
  finally {
    if (timer !== undefined) clearTimeout(timer)
  }
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
  return Buffer.isBuffer(value) ? value.toString() : value
}

function makeTemplateArray(command: string): TemplateStringsArray {
  return Object.assign([command], { raw: [command] })
}

function timeoutMessage(gate: GateConfig, command: string): string {
  return `Gate '${gate.name}' timed out after ${gate.timeoutMs}ms running: ${command}`
}

type SingleCommandOutcome
  = | { kind: 'ok', stdout: string, stderr: string }
    | { kind: 'failed', result: CommandResult }

/**
 * Build the shell invocation for one gate command: apply the hard `timeout`
 * wrapper when configured, then opt into quiet/nothrow so a non-zero exit is
 * surfaced as data instead of a rejection.
 */
function buildInvocation(shell: Shell, command: string, timeoutMs: number | undefined): ShellPromise {
  const effectiveCommand = timeoutMs === undefined ? command : applyCommandTimeout(command, timeoutMs)
  const rawInvocation = shell(makeTemplateArray(effectiveCommand))
  let invocation = typeof rawInvocation.quiet === 'function' ? rawInvocation.quiet() : rawInvocation

  if (typeof invocation.nothrow === 'function') {
    invocation = invocation.nothrow()
  }

  return invocation
}

/**
 * Shape a timed-out command into the canonical `{ exitCode: 124, timedOut: true }`
 * failure, falling back to the descriptive timeout message when no stderr exists.
 */
function timedOutResult(gate: GateConfig, command: string, stdout: string, stderr: string): SingleCommandOutcome {
  return {
    kind: 'failed',
    result: {
      exitCode: TIMEOUT_EXIT_CODE,
      stdout,
      stderr: stderr || timeoutMessage(gate, command),
      timedOut: true,
    },
  }
}

async function runSingleCommand(gate: GateConfig, command: string, shell: Shell): Promise<SingleCommandOutcome> {
  const invocation = buildInvocation(shell, command, gate.timeoutMs)
  const output = await awaitWithTimeout(invocation, gate.timeoutMs)

  if (output === TIMED_OUT) {
    return timedOutResult(gate, command, '', '')
  }

  const stdout = await output.text()
  const stderr = toStringOutput(output.stderr)

  if (output.exitCode === 0) {
    return { kind: 'ok', stdout, stderr }
  }

  return output.exitCode === TIMEOUT_EXIT_CODE && gate.timeoutMs !== undefined ? timedOutResult(gate, command, stdout, stderr) : { kind: 'failed', result: { exitCode: output.exitCode, stdout, stderr } }
}

export async function runGate(gate: GateConfig, shell: Shell): Promise<CommandResult> {
  let combinedStdout = ''
  let combinedStderr = ''

  for (const command of gate.commands) {
    const outcome = await runSingleCommand(gate, command, shell)

    if (outcome.kind === 'failed') {
      return outcome.result
    }

    combinedStdout += outcome.stdout
    combinedStderr += outcome.stderr
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
    return adaptive <= 0 ? maxQuietMs : Math.min(adaptive, maxQuietMs)
  }

  function cancelTimer(): void {
    if (timer === undefined) {
      return
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
