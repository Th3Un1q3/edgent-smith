import { Effect, Stream } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'

import { INTERRUPT_REASONS } from '../core/machine'
import type { EmitRequest, InterruptReason, SessionStart, StateMachine } from '../core/machine'
import { isUserItem, readUserText } from '../core/inbox'
import { createSessionReader } from '../../helpers/session/read'

type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

const interruptReason = (value: unknown): InterruptReason | undefined =>
  typeof value === 'string' ? INTERRUPT_REASONS.find(reason => reason === value) : undefined

export interface SessionEventDependencies {
  readonly context: Context
  readonly machine: Pick<StateMachine, 'wake' | 'userInput' | 'interrupted'>
  readonly open: (sessionId: string, agent: string, parentID?: string) => Effect.Effect<boolean>
  readonly ensureSession: (sessionId: string, agent: string, parentID?: string) => Effect.Effect<SessionStart | undefined>
  readonly parentOf: (sessionId: string) => Effect.Effect<string | undefined>
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
  const { context, machine, open, ensureSession, parentOf, logSnapshot, deliver, persist, offerIdle } = dependencies
  const sessionReader = createSessionReader(context)

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.created' }> & {
      readonly data: { readonly agent: string }
    } => event.type === 'session.created' && event.data.agent !== undefined),
    Stream.runForEach(event => Effect.gen(function* () {
      const sessionId = event.data.sessionID as unknown as string
      const agent = event.data.agent

      // The loop opens silently: its goal request is a reply to the person,
      // not a greeting into a chat that has no message yet.
      const started = yield* ensureSession(sessionId, agent, yield* parentOf(sessionId))

      if (started?.snapshot === 'read-failed') yield* logSnapshot(sessionId, 'read-failed')
    })),
    Effect.forkScoped,
  )

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.inbox.enqueued' }> =>
      event.type === 'session.inbox.enqueued',
    ),
    Stream.runForEach(event => Effect.gen(function* () {
      const item = event.data.item

      if (!isUserItem(item)) return

      const sessionId = event.data.sessionID as unknown as string
      const identity = yield* sessionReader.read(sessionId, 'fresh')
      const agent = identity.agent

      // A message can be the first access after a reload: open (or restore)
      // the session before delivering it, or the input has no machine to wake.
      if (agent !== undefined) yield* open(sessionId, agent, yield* parentOf(sessionId))

      // The first real message wakes the loop and receives its goal request.
      yield* deliver(sessionId, machine.wake(sessionId))

      const emits = machine.userInput(sessionId, readUserText(item))

      yield* deliver(sessionId, emits)
      yield* persist(sessionId)
    }).pipe(Effect.catchCause(() => Effect.void))),
    Effect.forkScoped,
  )

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.idle' }> =>
      event.type === 'session.idle',
    ),
    Stream.runForEach(event => Effect.gen(function* () {
      const sessionId = event.data.sessionID as unknown as string

      const identity = yield* sessionReader.read(event.data.sessionID, 'fresh')
      const agent = identity.agent

      if (agent !== undefined) yield* open(sessionId, agent, yield* parentOf(sessionId))

      yield* offerIdle(sessionId)
    })),
    Effect.forkScoped,
  )

  yield* context.event.subscribe().pipe(
    Stream.filter((event): event is Extract<PluginEvent, { type: 'session.execution.interrupted' }> =>
      event.type === 'session.execution.interrupted',
    ),
    Stream.runForEach(event => Effect.gen(function* () {
      const sessionId = event.data.sessionID as unknown as string
      const reason = interruptReason(event.data.reason)

      // A turn the host stopped is not a failure: no reason the loop knows
      // parks anything, and the next idle must not escalate to panic.
      if (reason === undefined) return

      // No `open`: an interruption for a session the loop never started must
      // not create a machine, and a running session already has one.
      const emits = machine.interrupted(sessionId, reason)

      yield* deliver(sessionId, emits)
      yield* persist(sessionId)
    })),
    Effect.forkScoped,
  )
})
