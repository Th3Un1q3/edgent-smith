import { Cause, Data, Deferred, Effect, Exit } from 'effect'

import { DEFAULT_MACHINE } from '../machines'
import type { MachineModule } from '../machines'
import type { CallbackPayload, InjectedMemories, LoopContext } from '../machines/session/context'

import { assembleMachine, hasStatePath, statePathsOf } from './machine-assembly'
import type { NestedStates } from './machine-assembly'
import { callbackEvent } from './machine-contract'
import type {
  Actor,
  CallbackName,
  EmitRequest,
  InterruptReason,
  LoopEvent,
  LoopStateId,
  MachineContext,
  SessionMachine,
  SignalsPolicy,
  StateMachineLibrary,
} from './machine-contract'
import { refusalMessage, renderSignals, stateLeaf, stateValuePath, validateSignal } from './signals'
import type { SignalRefusal, SignalSpec, SignalTable } from './signals'
import type { AbsentReason, PersistedSnapshot, SnapshotRead, SnapshotStore, ToolPolicyRule } from './snapshot'

/**
The name→spec table for one policy: only the names it enables, each resolved
through the one registry. A session with no policy leaves nothing available.
*/
const policyTable = (registry: Readonly<Record<string, SignalSpec>>, policy: SignalsPolicy | undefined): SignalTable => {
  // A null prototype keeps an inherited name (`constructor`, `__proto__`) out of
  // the table, so only a name the registry declares can be enabled.
  const declared = new Map(Object.entries(registry))

  const entries = (policy?.names ?? []).flatMap((name): [string, SignalSpec][] => {
    const spec = declared.get(name)

    return spec === undefined ? [] : [[name, spec]]
  })

  return Object.assign(Object.create(null) as SignalTable, Object.fromEntries(entries))
}

// The factory surface is not a production path: a handle cannot exist without
// an entry, so a call here for a session with no entry is a caller bug. It fails
// typed with the path that made it, and the boundary that catches
// `MachineUnavailable` logs `[state-machine] <path> <sessionId>: no-entry`.
const missingEntry = (path: string, sessionId: string): MachineUnavailable =>
  new MachineUnavailable({ sessionId, reason: 'no-entry', detail: path })

interface StateMachineOptions {
  readonly library: StateMachineLibrary
  readonly machine?: MachineModule
  readonly maxAttempts?: number
  readonly memoryLimit?: number
  readonly snapshot?: SnapshotStore
}

export interface SessionStart {
  readonly machine: SessionMachine
  readonly created: boolean
  readonly emits: readonly EmitRequest[]
  /**
  How the machine came to exist: restored from a snapshot, fresh at the agent's
  start state, or a read that was rejected and left the session without one.
  */
  readonly snapshot?: 'restored' | 'fresh' | 'read-failed' | 'expired' | 'shape-invalid' | 'legacy'
}

export interface SignalResult {
  readonly text: string
  readonly emits: readonly EmitRequest[]
  readonly refusal?: SignalRefusal
}

/**
Runs one emitted shell command outside the actor and reports the outcome.
*/
export type RunShell = (command: string, cwd: string) => Effect.Effect<CallbackPayload>

/**
Injects one skill into the session and reports completion.
*/
export type InjectSkill = (sessionId: string, name: string) => Effect.Effect<void, unknown>

/**
Reads the remembered preferences for one namespace.
*/
export type LoadMemories = (namespace: string) => Effect.Effect<InjectedMemories, unknown>

export interface SessionIdentity {
  readonly agent: string
  readonly parentID?: string
}

export type UnavailableReason = 'no-identity' | 'read-failed' | 'no-entry' | 'invalid-snapshot'

export class MachineUnavailable extends Data.TaggedError('MachineUnavailable')<{
  readonly sessionId: string
  readonly reason: UnavailableReason
  readonly detail?: string
}> {}

/**
Every read, transition and persist of a session's machine goes through its
handle, so a caller that holds one cannot reach an entry-less session.
*/
export interface MachineHandle {
  readonly sessionId: string
  readonly machine: SessionMachine
  readonly state: LoopStateId
  readonly policy: ToolPolicyRule | undefined
  signal(input: unknown): SignalResult
  signalLine(keys?: readonly string[]): string
  status(): string
  wake(): readonly EmitRequest[]
  userInput(text: string): readonly EmitRequest[]
  interrupted(reason: InterruptReason): readonly EmitRequest[]
  callback(name: CallbackName, payload: CallbackPayload): readonly EmitRequest[]
  idle(): Effect.Effect<readonly EmitRequest[]>
  persist(): Effect.Effect<'written' | 'skipped' | 'write-failed'>
}

export interface StateMachine {
  /**
  Creates the session's machine at admission; never on a signal.
  */
  start: (sessionId: string, agent: string) => SessionStart | undefined
  /**
  A live handle for the session, restoring it from its snapshot on first
  access. Fails instead of reporting a machine-less session, because an absent
  entry is a routine state and a silent empty result hides it.
  */
  access: (sessionId: string, identity: SessionIdentity | undefined) => Effect.Effect<MachineHandle, MachineUnavailable>
  /**
  Restores the session from its snapshot on first access, or starts it fresh.
  Concurrent first accesses share one read. Undefined means the read was
  rejected, so the session has no machine and the gate allows.
  */
  ensure: (sessionId: string, agent: string) => Effect.Effect<SessionStart | undefined>
  /**
  Writes the whole snapshot after a change. `skipped` means no machine or no
  store; `write-failed` means the store rejected it and the previous record stands.
  */
  persist: (sessionId: string) => Effect.Effect<'written' | 'skipped' | 'write-failed'>
  get: (sessionId: string) => SessionMachine | undefined
  /**
  The state and the active tool policy, read from memory.
  */
  state: (sessionId: string) => LoopStateId | undefined
  policy: (sessionId: string) => ToolPolicyRule | undefined
  /**
  The emits a fresh session held for its first user message; empty afterwards.
  */
  wake: (sessionId: string) => readonly EmitRequest[]
  /**
  Applies one signal. A refusal is a normal result, not a failure.
  */
  signal: (input: unknown, sessionId: string) => SignalResult
  /**
  Delivers a subscriber's answer as an ordinary event.
  */
  callback: (sessionId: string, name: CallbackName, payload: CallbackPayload) => readonly EmitRequest[]
  /**
  A user message restarts the round from `parked` or `panic`.
  */
  userInput: (sessionId: string, text: string) => readonly EmitRequest[]
  /**
  An interruption parks the loop: the person taking control, not a failure.
  */
  interrupted: (sessionId: string, reason: InterruptReason) => readonly EmitRequest[]
  /**
  The machine's current position, for a tool call without an agent context.
  */
  status: (sessionId: string) => string
  /**
  The rendered signal list for the session's policy.
  */
  signalLine: (sessionId: string, signal_keys?: readonly string[]) => string
  idle: (sessionId: string) => Effect.Effect<readonly EmitRequest[]>
}

interface MachineEntry {
  readonly actor: Actor
  readonly sessionId: string
  readonly agent: string
  /**
  Entry emits held until a real user message arrives. A session starts silently:
  the goal request is a reply to the person, not a greeting into an empty chat.
  */
  pending: EmitRequest[]
}

export const createStateMachine = (options: StateMachineOptions): StateMachine => {
  const module = options.machine ?? DEFAULT_MACHINE
  const assembly = assembleMachine(module)
  const stateIds: ReadonlySet<string> = new Set(
    statePathsOf(assembly.loop.states as unknown as Readonly<Record<string, NestedStates<unknown>>>),
  )
  const initialState: LoopStateId
    = (assembly.loop.initial as LoopStateId | undefined) ?? (Object.keys(assembly.loop.states)[0] as LoopStateId)
  const machines = new Map<string, MachineEntry>()
  const waiting = new Map<string, Deferred.Deferred<SessionStart, MachineUnavailable>>()

  /**
  A transient state is left behind on restore whether the module declares it at
  the root or inside a compound state.
  */
  const isTransient = (state: LoopStateId): boolean =>
    assembly.transientStates.has(state) || assembly.transientStates.has(state.slice(state.lastIndexOf('.') + 1))

  /**
  The actor's own context: the tool policy lives there, installed by the entry
  action and cleared by the exit action, so a transition keeps it in step.
  */
  const liveContext = (entry: MachineEntry): MachineContext => entry.actor.context()

  const view = (entry: MachineEntry): SessionMachine => ({
    sessionId: entry.sessionId,
    agent: entry.agent,
    state: entry.actor.state(),
    context: liveContext(entry) as unknown as LoopContext,
  })

  const contextFor = (sessionId: string, agent: string, parentID: string | undefined): MachineContext =>
    module.contexts.fresh({ sessionId, agent, parentID, maxAttempts: options.maxAttempts, memoryLimit: options.memoryLimit })

  const restoredContext = (stored: Readonly<Record<string, unknown>>, agent: string, parentID: string | undefined): MachineContext =>
    module.contexts.restore(stored, {
      sessionId: String(stored.sessionId),
      agent,
      parentID,
      maxAttempts: options.maxAttempts,
      memoryLimit: options.memoryLimit,
    })

  const create = (
    sessionId: string,
    agent: string,
    context: MachineContext,
    parentID: string | undefined,
    restored?: PersistedSnapshot,
  ): SessionStart => {
    const actor = options.library.createActor(assembly.loop, initialState, context, restored)
    const entry: MachineEntry = { actor, sessionId, agent, pending: [] }

    // A session is created before its agent is known; `admit` is how `admission`
    // leaves the state it entered while the identity was empty.
    entry.actor.send({ type: 'admit', agent, parentID })

    if (actor.restored === true) entry.actor.takeEmits()
    else entry.pending = [...entry.actor.takeEmits()]

    machines.set(sessionId, entry)

    return {
      machine: view(entry),
      created: true,
      emits: [],
      snapshot: actor.restored === true ? 'restored' : 'fresh',
    }
  }

  /**
  Hands back what the entry held for the first real user message.
  */
  const wake = (sessionId: string): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('wake', sessionId)

    const held = entry.pending
    entry.pending = []
    return held
  }

  const start = (sessionId: string, agent: string, parentID?: string): SessionStart => {
    const existing = machines.get(sessionId)

    return existing === undefined ? create(sessionId, agent, contextFor(sessionId, agent, parentID), parentID) : { machine: view(existing), created: false, emits: [] }
  }

  const isLiveStatePath = (path: string): boolean =>
    path !== ''
    && !isTransient(path)
    && hasStatePath(assembly.loop.states as unknown as Readonly<Record<string, NestedStates<unknown>>>, path)

  const isUsableSnapshot = (stored: PersistedSnapshot): boolean => {
    const path = stateValuePath(stored.value)

    return stored.status !== 'error' && isLiveStatePath(path)
  }

  const startFromAbsent = (
    reason: AbsentReason,
    sessionId: string,
    agent: string,
    parentID: string | undefined,
  ): Effect.Effect<SessionStart> => Effect.gen(function* () {
    if (reason === 'legacy') {
      yield* Effect.logInfo('[state-machine] snapshot state-machine/' + sessionId + ' v1 record, starting fresh')
    }

    const started = create(sessionId, agent, contextFor(sessionId, agent, parentID), parentID)

    return reason === 'missing' ? started : { ...started, snapshot: reason }
  })

  const restoredStart = (
    stored: PersistedSnapshot,
    sessionId: string,
    agent: string,
    parentID?: string,
  ): SessionStart => isUsableSnapshot(stored)
    ? create(sessionId, agent, restoredContext(stored.context as Readonly<Record<string, unknown>>, agent, parentID), parentID, stored)
    : { ...create(sessionId, agent, contextFor(sessionId, agent, parentID), parentID), snapshot: 'shape-invalid' }

  const startFromRead = (
    read: SnapshotRead,
    sessionId: string,
    agent: string,
    parentID: string | undefined,
  ): Effect.Effect<SessionStart, MachineUnavailable> =>
    read.status === 'rejected'
      ? Effect.fail(new MachineUnavailable({ sessionId, reason: 'read-failed', detail: read.reason }))
      : (read.status === 'absent'
          ? startFromAbsent(read.reason, sessionId, agent, parentID)
          : Effect.succeed(restoredStart(read.record.snapshot, sessionId, agent, parentID)))

  const load = (sessionId: string, agent: string, parentID?: string): Effect.Effect<SessionStart, MachineUnavailable> => Effect.gen(function* () {
    const snapshot = options.snapshot

    if (snapshot === undefined) return start(sessionId, agent, parentID)

    const read = yield* snapshot.read(sessionId, stateIds)

    return yield* startFromRead(read, sessionId, agent, parentID)
  })

  /**
  Restores or starts the entry on first access. Concurrent first accesses share
  one read, and every one of them receives the same typed failure when it
  rejects, so a reload burst cannot create two actors for one session.
  */
  const restore = (sessionId: string, agent: string, parentID?: string): Effect.Effect<SessionStart, MachineUnavailable> => Effect.suspend(() => {
    const existing = machines.get(sessionId)

    if (existing !== undefined) return Effect.succeed<SessionStart>({ machine: view(existing), created: false, emits: [] })

    const waitingOn = waiting.get(sessionId)

    if (waitingOn !== undefined) return Deferred.await(waitingOn)

    const deferred = Deferred.makeUnsafe<SessionStart, MachineUnavailable>()

    waiting.set(sessionId, deferred)

    const settle = (exit: Exit.Exit<SessionStart, MachineUnavailable>): Effect.Effect<SessionStart, MachineUnavailable> =>
      Effect.flatMap(Deferred.done(deferred, exit), () =>
        Exit.isSuccess(exit) ? Effect.succeed(exit.value) : Effect.failCause(exit.cause))

    return load(sessionId, agent, parentID).pipe(
      Effect.exit,
      Effect.flatMap(exit => settle(exit)),
      Effect.ensuring(Effect.sync(() => { waiting.delete(sessionId) })),
    )
  })

  const ensure = (sessionId: string, agent: string, parentID?: string): Effect.Effect<SessionStart | undefined> =>
    restore(sessionId, agent, parentID).pipe(
      Effect.catchCause(() => Effect.succeed<SessionStart | undefined>(undefined)),
    )

  const persist = (sessionId: string): Effect.Effect<'written' | 'skipped' | 'write-failed'> => Effect.suspend(() => {
    const entry = machines.get(sessionId)
    const snapshot = options.snapshot

    return entry === undefined || snapshot === undefined
      ? Effect.logWarning('[state-machine] persist ' + sessionId + ': skipped').pipe(
          Effect.as('skipped' as const),
        )
      : snapshot.write(entry.actor.persistedSnapshot()).pipe(
          Effect.map(ok => ok ? 'written' as const : 'write-failed' as const),
          Effect.catchCause(cause => Effect.logWarning(
            '[state-machine] persist ' + sessionId + ': write-failed cause=' + Cause.pretty(cause),
          ).pipe(Effect.andThen(Effect.succeed('write-failed' as const)))),
        )
  })

  /**
  Any event means the loop is awake: a held goal request must not arrive late.
  */
  const markAwake = (entry: MachineEntry): void => {
    entry.pending = []
  }

  /**
  The one path an event takes: sent through the actor, the held entry emits
  cleared, then what the actor emitted drained, in that order.
  */
  const dispatch = (entry: MachineEntry, event: LoopEvent): readonly EmitRequest[] => {
    entry.actor.send(event)
    markAwake(entry)
    return entry.actor.takeEmits()
  }

  const signal = (input: unknown, sessionId: string): SignalResult => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('signal', sessionId)

    const state = entry.actor.state()
    const table = policyTable(assembly.registry, liveContext(entry).signalsPolicy)
    const validation = validateSignal(input, state, table, assembly.registry)

    return validation.ok
      ? {
          text: 'Signal accepted.',
          emits: dispatch(entry, validation.event),
        }
      : {
          text: refusalMessage(validation.refusal, table),
          emits: [],
          refusal: validation.refusal,
        }
  }

  const status = (sessionId: string): string => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('status', sessionId)

    return 'State: ' + stateLeaf(entry.actor.state()) + '.'
  }

  const signalLine = (sessionId: string, signal_keys?: readonly string[]): string => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('signalLine', sessionId)

    return renderSignals(policyTable(assembly.registry, liveContext(entry).signalsPolicy), signal_keys)
  }

  const callback = (
    sessionId: string,
    name: CallbackName,
    payload: CallbackPayload,
  ): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('callback', sessionId)

    return dispatch(entry, { type: callbackEvent(name), payload })
  }

  const userInput = (sessionId: string, text: string): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('userInput', sessionId)

    return dispatch(entry, { type: 'system_user_input', text })
  }

  const interrupted = (sessionId: string, reason: InterruptReason): readonly EmitRequest[] => {
    const entry = machines.get(sessionId)

    if (entry === undefined) throw missingEntry('interrupted', sessionId)

    return dispatch(entry, { type: 'system_interrupted', reason })
  }

  // `idle` already runs in an effect, so a missing entry is logged where it
  // happens rather than thrown past the subscription that owns the session.
  const idle = (sessionId: string): Effect.Effect<readonly EmitRequest[]> =>
    Effect.suspend(() => {
      const entry = machines.get(sessionId)

      return entry === undefined
        ? Effect.logWarning('[state-machine] idle ' + sessionId + ': no-entry').pipe(
            Effect.andThen(Effect.succeed<readonly EmitRequest[]>([])),
          )
        : Effect.sync(() => dispatch(entry, { type: 'system_idle' }))
    })

  const stateOf = (sessionId: string): LoopStateId | undefined => machines.get(sessionId)?.actor.state()
  const policyOf = (sessionId: string): ToolPolicyRule | undefined =>
    machines.get(sessionId)?.actor.context().policy

  const handleOf = (entry: MachineEntry): MachineHandle => ({
    sessionId: entry.sessionId,
    machine: view(entry),
    state: entry.actor.state(),
    policy: liveContext(entry).policy,
    signal: input => signal(input, entry.sessionId),
    signalLine: keys => signalLine(entry.sessionId, keys),
    status: () => status(entry.sessionId),
    wake: () => wake(entry.sessionId),
    userInput: text => userInput(entry.sessionId, text),
    interrupted: reason => interrupted(entry.sessionId, reason),
    callback: (name, payload) => callback(entry.sessionId, name, payload),
    idle: () => idle(entry.sessionId),
    persist: () => persist(entry.sessionId),
  })

  const accessHandle = (sessionId: string): Effect.Effect<MachineHandle, MachineUnavailable> => {
    const entry = machines.get(sessionId)

    return entry === undefined
      ? Effect.fail(new MachineUnavailable({ sessionId, reason: 'no-entry' }))
      : Effect.succeed(handleOf(entry))
  }

  const access = (
    sessionId: string,
    identity: SessionIdentity | undefined,
  ): Effect.Effect<MachineHandle, MachineUnavailable> => Effect.suspend(() => {
    const entry = machines.get(sessionId)

    if (entry !== undefined) return Effect.succeed(handleOf(entry))

    return identity === undefined ? Effect.fail(new MachineUnavailable({ sessionId, reason: 'no-identity' })) : Effect.flatMap(restore(sessionId, identity.agent, identity.parentID), () => accessHandle(sessionId))
  })

  return {
    start, access, ensure, persist, state: stateOf, policy: policyOf, signalLine, wake, get: (sessionId) => {
      const entry = machines.get(sessionId)
      return entry === undefined ? undefined : view(entry)
    }, signal, callback, userInput, interrupted, status, idle,
  }
}
