import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import type { Session } from '@opencode/schema/session'

import { causeText } from './cause-text'
import { RETROSPECTIVE_COMPLETE } from '../core/machine'
import type { CommandEmit } from '../core/machine'

const COMMAND_IN_FLIGHT = 'command-in-flight'
const COMMAND_PORT_UNAVAILABLE = 'command-port-unavailable: session.command'

export interface CommandRequest {
  readonly sessionID: string
  readonly name: string
  readonly text: string
  readonly files?: CommandEmit['files']
  readonly agents?: CommandEmit['agents']
  readonly skills?: CommandEmit['skills']
  readonly delivery?: CommandEmit['delivery']
}

export type SendCommand = (request: CommandRequest) => Effect.Effect<void, unknown>

/**
The default port: the host's session command facility. A host that omits it is
refused by name at the raise, so no session waits on a command nobody ran.
*/
const sessionCommandPort = (context: Context): SendCommand | undefined => {
  const command = (context.session as unknown as { readonly command?: SendCommand }).command

  return command === undefined
    ? undefined
    : request => command({ ...request, sessionID: request.sessionID as Session.ID })
}

export type CommandRaise = { readonly ok: true } | { readonly ok: false, readonly output: string }

export interface CommandRunner {
  readonly raise: (sessionId: string, emit: CommandEmit) => Effect.Effect<CommandRaise>
  readonly isPending: (sessionId: string) => boolean
  readonly complete: (sessionId: string) => boolean
}

const commandRequest = (sessionId: string, emit: CommandEmit): CommandRequest => ({
  sessionID: sessionId,
  name: emit.name,
  text: emit.text ?? '',
  files: emit.files,
  agents: emit.agents,
  skills: emit.skills,
  delivery: emit.delivery,
})

/**
One command per session. A raise records the pending entry and returns, so the
event that raised it finishes before the command runs; the entry clears only
through `completeOnSignal`, never when the command is merely sent. A delivery the
host failed to start clears it too: no command is running, so nothing will
complete, and holding the session would hang the loop.
*/
export const createCommandRunner = (context: Context, port?: SendCommand): CommandRunner => {
  const pending = new Set<string>()
  const send = port ?? sessionCommandPort(context)

  return {
    isPending: sessionId => pending.has(sessionId),
    complete: sessionId => pending.delete(sessionId),
    raise: (sessionId, emit) => Effect.suspend((): Effect.Effect<CommandRaise> => {
      if (send === undefined) return Effect.succeed({ ok: false as const, output: COMMAND_PORT_UNAVAILABLE })
      if (pending.has(sessionId)) return Effect.succeed({ ok: false as const, output: COMMAND_IN_FLIGHT })

      pending.add(sessionId)

      const delivery = send(commandRequest(sessionId, emit)).pipe(
        Effect.matchCause({
          onFailure: cause => 'command-failed: ' + causeText(cause),
          onSuccess: () => {},
        }),
        Effect.tap(message => message === undefined
          ? Effect.void
          : Effect.sync(() => { pending.delete(sessionId) }).pipe(
              Effect.andThen(Effect.logError('[state-machine] emit.command refused for session ' + sessionId + ': ' + message)),
            )),
      )

      return Effect.forkDetach(delivery).pipe(Effect.as({ ok: true as const }))
    }),
  }
}

/**
The only path that clears a pending command: the completion signal arriving through
the signal tool. Any other signal leaves the entry in place.
*/
export const didCompleteOnSignal = (commands: CommandRunner, sessionId: string, signal: unknown): boolean =>
  signal === RETROSPECTIVE_COMPLETE ? commands.complete(sessionId) : false
