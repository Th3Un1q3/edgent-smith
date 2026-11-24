import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import type { Agent } from '@opencode/schema/agent'
import type { Session } from '@opencode/schema/session'

import { causeText } from './cause-text'
import type { CallbackPayload, SubagentEmit } from '../core/machine'

/**
A child run: create it under the parent, prompt it, and answer one payload for
whatever happened to it, so the caller never waits on a dead child.
*/
export type RunSubagent = (request: {
  readonly parentID: string
  readonly agent: string
  readonly text: string
  readonly timeoutMs: number
}) => Effect.Effect<CallbackPayload, unknown>

const SUBAGENT_IN_FLIGHT = 'spawn-in-flight'

const replyText = (reply: unknown): string => typeof reply === 'string' ? reply : JSON.stringify(reply) ?? ''

/**
`verdict` is present only when the judge answered, and the machine's fail arm
requires it. An unavailable port, a spawn the host refused and the timeout all
settle `ok: false` without it, so they record and leave the state to its own
self-report instead of panicking a working session.
*/
type JudgeVerdict = CallbackPayload & { readonly verdict?: 'pass' | 'fail' }

/**
Reads the judge's trailing `{ "verdict": "pass" | "fail", "reason": "..." }`. A
reply with no such object is the child's failure, not the machine's.
*/
const VERDICTS: ReadonlySet<unknown> = new Set(['pass', 'fail'])

const isVerdict = (value: unknown): value is 'pass' | 'fail' => VERDICTS.has(value)

const isAnsweredVerdict = (
  parsed: { readonly verdict?: unknown, readonly reason?: unknown },
): parsed is { readonly verdict: 'pass' | 'fail', readonly reason: string } =>
  isVerdict(parsed.verdict) && typeof parsed.reason === 'string' && parsed.reason !== ''

export const UNREADABLE_VERDICT_PREFIX = 'verdict-unreadable: '

const unreadableVerdict = (text: string): JudgeVerdict =>
  ({ ok: false, output: UNREADABLE_VERDICT_PREFIX + text.slice(0, 200) })

const parsedVerdict = (text: string): { readonly verdict?: unknown, readonly reason?: unknown } => {
  try {
    return JSON.parse(text)
  }
  catch {
    return {}
  }
}

const readVerdict = (text: string): JudgeVerdict => {
  const start = text.lastIndexOf('{')

  if (start === -1) return unreadableVerdict(text)

  const parsed = parsedVerdict(text.slice(start))

  return isAnsweredVerdict(parsed)
    ? { ok: parsed.verdict === 'pass', output: parsed.reason, verdict: parsed.verdict }
    : unreadableVerdict(text)
}

/**
The default port: the harness's own session facility. `session.wait` is not on the
plugin's Context type, so a host that omits it is refused by name instead of
hanging, and the read mechanism behind `wait` stays the host's business.
*/
const sessionSubagentPort = (context: Context): RunSubagent => request => Effect.gen(function* () {
  const session = context.session as unknown as {
    readonly create?: (input: { parentID: Session.ID, agent: Agent.ID }) => Effect.Effect<{ id: string }, unknown>
    readonly prompt?: (input: { sessionID: Session.ID, text: string }) => Effect.Effect<unknown>
    readonly wait?: (input: { sessionID: Session.ID }) => Effect.Effect<unknown>
  }

  const missing = (['create', 'prompt', 'wait'] as const).find(name => session[name] === undefined)

  if (missing !== undefined) {
    return yield* Effect.fail(new Error('subagent-port-unavailable: session.' + missing))
  }

  const port = session as Required<typeof session>
  const child = yield* port.create({ parentID: request.parentID as Session.ID, agent: request.agent as Agent.ID })
  yield* port.prompt({ sessionID: child.id as Session.ID, text: request.text })

  return readVerdict(replyText(yield* port.wait({ sessionID: child.id as Session.ID })))
})

export interface SubagentRunner {
  readonly spawn: (
    sessionId: string,
    emit: SubagentEmit,
    settle: (payload: CallbackPayload) => Effect.Effect<void>,
  ) => Effect.Effect<void>
  readonly pending: (sessionId: string) => string | undefined
}

/**
One child per session: a second spawn while one is pending is refused with
`spawn-in-flight`. A spawn is a request, not a wait: it records the pending entry,
starts the child on its own fiber and returns, so the event that raised it completes
before any verdict exists. The entry is cleared when that fiber ends — after the
verdict settles, or when the run is interrupted.
*/
export const createSubagentRunner = (
  context: Context,
  port?: RunSubagent,
): SubagentRunner => {
  const pending = new Map<string, string>()
  const run = port ?? sessionSubagentPort(context)

  return {
    pending: sessionId => pending.get(sessionId),
    spawn: (sessionId, emit, settle) => Effect.suspend(() => {
      if (pending.has(sessionId)) return settle({ ok: false, output: SUBAGENT_IN_FLIGHT })

      pending.set(sessionId, sessionId)

      const child = Effect.timeoutOption(
        run({ parentID: sessionId, agent: emit.agent, text: emit.text, timeoutMs: emit.timeoutMs }),
        emit.timeoutMs,
      ).pipe(
        Effect.match({
          onFailure: cause => ({ ok: false, output: 'spawn-failed: ' + causeText(cause) }),
          onSuccess: option => option._tag === 'None' ? { ok: false, output: 'timeout' } : option.value,
        }),
        Effect.flatMap(payload => settle(payload)),
        Effect.ensuring(Effect.sync(() => { pending.delete(sessionId) })),
      )

      return Effect.forkDetach(child).pipe(Effect.asVoid)
    }),
  }
}
