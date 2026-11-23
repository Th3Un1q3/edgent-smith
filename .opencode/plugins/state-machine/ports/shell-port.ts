import { execFile } from 'node:child_process'

import { Effect } from 'effect'

import type { CallbackPayload, RunShell } from '../core/machine'

const SHELL_TIMEOUT_MS = 120_000
const SHELL_MAX_BUFFER = 4 * 1024 * 1024

export const reportFailure = (label: string) => (cause: unknown): Effect.Effect<void> =>
  Effect.logError('[state-machine] ' + label + ': ' + String(cause))

const failurePayload = (
  cause: { readonly code?: number | string, readonly message: string },
  stdout: string,
  stderr: string,
): CallbackPayload => ({
  ok: false,
  exitCode: typeof cause.code === 'number' ? cause.code : 1,
  output: stdout + stderr || cause.message,
})

export const runShellCommand: RunShell = (command, cwd) =>
  Effect.promise(() => new Promise<CallbackPayload>((resolve) => {
    execFile(
      'bash',
      ['-c', command],
      { cwd, timeout: SHELL_TIMEOUT_MS, maxBuffer: SHELL_MAX_BUFFER },
      (cause, stdout, stderr) => {
        if (cause === null) {
          resolve({ ok: true, exitCode: 0, output: stdout + stderr })
          return
        }

        resolve(failurePayload(cause, stdout, stderr))
      },
    )
  }))
