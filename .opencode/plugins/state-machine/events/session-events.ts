import { Cause, Effect, Exit, Option, Stream } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'

import { INTERRUPT_REASONS } from '../core/machine'
import type {
  EmitRequest,
  InterruptReason,
  MachineHandle,
  MachineUnavailable,
  SessionIdentity,
  SessionStart,
  StateMachine,
} from '../core/machine'
import { isUserItem, readUserText } from '../core/inbox'
import { createSessionReader } from '../../helpers/session/read'

type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

const interruptReason = (value: unknown): InterruptReason | undefined =>
  typeof value === 'string' ? INTERRUPT_REASONS.find(reason => reason === value) : undefined

// A malformed host payload costs one event, not the subscription: the boundary
// that reports the failure still needs a session id to name in the line.
const sessionOf = (event: PluginEvent): string => {
  try {
    const data = event.data as { readonly sessionID?: unknown }
    return typeof data.sessionID === 'string' ? data.sessionID : 'unknown'
  }
  catch {
    return 'unknown'
  }
}

const unavailableWarning = (path: string, error: MachineUnavailable): Effect.Effect<void> =>
  Effect.logWarning('[state-machine] ' + path + ' ' + error.sessionId + ': ' + error.reason)

// Without this boundary a defect ends the subscription, and every later event
// for every session waits on a consumer that is gone.
const bounded = (event: string, sessionId: string, body: Effect.Effect<void, unknown>): Effect.Effect<void> =>
  body.pipe(
    Effect.catchCause(cause => Effect.logWarning(
      '[state-machine] handler session=' + sessionId + ' event=' + event + ' failed cause=' + Cause.pretty(cause),
    )),
  )

export interface SessionEventDependencies {
  readonly context: Context
  readonly machine: Pick<StateMachine, 'access'>
  readonly open: (sessionId: string, agent: string, parentID?: string) => Effect.Effect<boolean>
  readonly ensureSession: (sessionId: string, agent: string, parentID?: string) => Effect.Effect<SessionStart | undefined>
  readonly parentOf: (sessionId: string) => Effect.Effect<string | undefined, unknown>
  readonly logSnapshot: (sessionId: string, status: string) => Effect.Effect<void>
  readonly deliver: (sessionId: string, emits: readonly EmitRequest[]) => Effect.Effect<void>
  readonly persist: (sessionId: string) => Effect.Effect<void>
  readonly offerIdle: (sessionId: string) => Effect.Effect<void>
}

/**
The four subscriptions the loop answers. They are scoped to the caller's effect,
so the plugin's unload releases them with the tool and the hooks.
*/
export const registerSessionEvents = (dependencies: SessionEventDependencies) => Effect.gen(function* () {
  const { context, machine, open, parentOf, deliver, persist, offerIdle } = dependencies
  const sessionReader = createSessionReader(context)

  const identityOf = (sessionId: string): Effect.Effect<SessionIdentity | undefined, unknown> =>
    sessionReader.read(sessionId, 'fresh').pipe(
      Effect.map(identity => identity.agent === undefined
        ? undefined
        : { agent: identity.agent, parentID: identity.parentID }),
    )

  /**
  Restores the session on first access and reports why it could not: an absent
  entry or a rejected read is a named failure, never an empty result.
  */
  const accessOrWarn = (
    sessionId: string,
    path: string,
    identity: SessionIdentity | undefined,
  ): Effect.Effect<MachineHandle | undefined> => Effect.gen(function* () {
    const exit = yield* Effect.exit(machine.access(sessionId, identity))

    if (Exit.isSuccess(exit)) return exit.value

    const error = Exit.findErrorOption(exit)

    if (Option.isNone(error)) {
      yield* Effect.logWarning('[state-machine] ' + path + ' ' + sessionId + ': defect ' + Cause.pretty(exit.cause))
      return
    }

    yield* unavailableWarning(path, error.value)

    return
  })

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.created' }> & {
      readonly data: { readonly agent: string }
    } => event.type === 'session.created' && event.data.agent !== undefined),
    Stream.runForEach((event) => {
      const sessionId = sessionOf(event)

      // The loop opens silently: its goal request is a reply to the person,
      // not a greeting into a chat that has no message yet.
      return bounded('session.created', sessionId, Effect.gen(function* () {
        yield* accessOrWarn(sessionId, 'session.created', {
          agent: event.data.agent,
          parentID: yield* parentOf(sessionId),
        })
      }))
    }),
    Effect.forkScoped,
  )

  /**
  The first real message wakes the loop and receives its goal request; a
  session the open could not reach is reported by `accessOrWarn`, not dropped.
  */
  const deliverUserItem = (
    sessionId: string,
    item: Parameters<typeof readUserText>[0],
    identity: { readonly agent?: string, readonly parentID?: string },
  ): Effect.Effect<void> => Effect.gen(function* () {
    const handle = yield* accessOrWarn(sessionId, 'inbox.enqueued', identity.agent === undefined
      ? undefined
      : { agent: identity.agent, parentID: identity.parentID })

    if (handle === undefined) return

    yield* deliver(sessionId, handle.wake())
    yield* deliver(sessionId, handle.userInput(readUserText(item)))
    yield* persist(sessionId)
  })

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.inbox.enqueued' }> =>
      event.type === 'session.inbox.enqueued',
    ),
    Stream.runForEach((event) => {
      const sessionId = sessionOf(event)

      return bounded('session.inbox.enqueued', sessionId, Effect.gen(function* () {
        const item = event.data.item

        if (!isUserItem(item)) return

        const identity = yield* sessionReader.read(sessionId, 'fresh')

        // A message can be the first access after a reload: open (or restore)
        // the session before delivering it, or the input has no machine to wake.
        if (identity.agent !== undefined) yield* open(sessionId, identity.agent, yield* parentOf(sessionId))

        yield* deliverUserItem(sessionId, item, identity)
      }))
    }),
    Effect.forkScoped,
  )

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.idle' }> =>
      event.type === 'session.idle',
    ),
    Stream.runForEach((event) => {
      const sessionId = sessionOf(event)

      // An idle after a reload arrives before anything reopened the session:
      // access restores it from its snapshot, so the idle still nudges.
      return bounded('session.idle', sessionId, Effect.gen(function* () {
        const handle = yield* accessOrWarn(sessionId, 'idle', yield* identityOf(sessionId))

        if (handle === undefined) return

        yield* offerIdle(sessionId)
      }))
    }),
    Effect.forkScoped,
  )

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.execution.interrupted' }> =>
      event.type === 'session.execution.interrupted',
    ),
    Stream.runForEach((event) => {
      const sessionId = sessionOf(event)

      return bounded('session.execution.interrupted', sessionId, Effect.gen(function* () {
        const reason = interruptReason(event.data.reason)

        // A turn the host stopped is not a failure: no reason the loop knows
        // parks anything, and the next idle must not escalate to panic.
        if (reason === undefined) return

        // No identity: an interruption must not create a machine, and a running
        // session already has one, so an absent entry is reported, not restored.
        const handle = yield* accessOrWarn(sessionId, 'interrupted', undefined)

        if (handle === undefined) return

        yield* deliver(sessionId, handle.interrupted(reason))
        yield* persist(sessionId)
      }))
    }),
    Effect.forkScoped,
  )
})
