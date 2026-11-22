/**
 * state-machine — OpenCode v2 Effect plugin.
 *
 * Registers the `signal_send` tool and the event subscriptions: session start
 * places the session in the state its agent is configured for, an idle session
 * is offered the transition it can take, and an interrupted turn is parked. The
 * machine emits what it wants done; the plugin delivers those emits and returns
 * shell results as callbacks. The entry holds no transition logic; everything
 * lives in `core/machine.ts`.
 */
import { execFile } from 'node:child_process'

import { Effect, Stream } from 'effect'
import type { JsonSchema } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import type { Agent } from '@opencode/schema/agent'
import type { Session } from '@opencode/schema/session'
import type { Skill } from '@opencode/schema/skill'
import { Tool } from '@opencode/schema/tool'

import { harnessConfig } from './config/harness.config'
import { createSnapshotStore } from './state-machine/core/snapshot'
import { memoryKey, readMemories } from './state-machine/core/memory'
import { decide, GATE_AGENT } from './state-machine/core/policy'
import { isUserItem, readUserText } from './state-machine/core/inbox'
import {
  createStateMachine,
  INTERRUPT_REASONS,
  RETROSPECTIVE_COMPLETE,
  loadStateMachineLibrary,
  promptDescription,
  readStartConfig,
} from './state-machine/core/machine'
import type { MachineModule } from './state-machine/machines'
import type {
  CallbackName,
  CallbackPayload,
  CommandEmit,
  EmitRequest,
  InjectSkill,
  InterruptReason,
  LoadMemories,
  RunShell,
  SignalsEmit,
  StateMachineLibrary,
  SubagentEmit,
} from './state-machine/core/machine'

const SIGNAL_TOOL = 'signal_send'
const SHELL_TIMEOUT_MS = 120_000
const SHELL_MAX_BUFFER = 4 * 1024 * 1024
const SIGNALS_PROMPT_DESCRIPTION = 'The session loop is listing the signals the policy enables.'

type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

const interruptReason = (value: unknown): InterruptReason | undefined =>
  typeof value === 'string' ? INTERRUPT_REASONS.find(reason => reason === value) : undefined

const signalType = (input: unknown): unknown =>
  typeof input === 'object' && input !== null && 'type' in input ? input.type : undefined

const signalInput: JsonSchema.JsonSchema = {
  type: 'object',
  required: ['type'],
  additionalProperties: false,
  properties: {
    type: {
      type: 'string',
      description: 'The signal to send. Only a name the signals policy enables is accepted.',
    },
    payload: {
      type: 'object',
      description: 'Fields declared for that signal by the signals policy; omit it for a payloadless signal.',
    },
  },
}

const reportFailure = (label: string) => (cause: unknown): Effect.Effect<void> =>
  Effect.logError('[state-machine] ' + label + ': ' + String(cause))

const runShellCommand: RunShell = (command, cwd) =>
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

        resolve({
          ok: false,
          exitCode: typeof cause.code === 'number' ? cause.code : 1,
          output: stdout + stderr || cause.message,
        })
      },
    )
  }))

/**
The loader and the effect ports are parameters so a test can fail the load or
answer a command, a skill and a memory read without their real implementations.
*/
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

const causeText = (cause: unknown): string => cause instanceof Error ? cause.message : String(cause)

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
const readVerdict = (text: string): JudgeVerdict => {
  const start = text.lastIndexOf('{')
  const unreadable: JudgeVerdict = { ok: false, output: 'verdict-unreadable: ' + text.slice(0, 200) }

  if (start === -1) return unreadable

  try {
    const parsed: { readonly verdict?: unknown, readonly reason?: unknown } = JSON.parse(text.slice(start))

    return (parsed.verdict === 'pass' || parsed.verdict === 'fail')
      && typeof parsed.reason === 'string' && parsed.reason !== ''
      ? { ok: parsed.verdict === 'pass', output: parsed.reason, verdict: parsed.verdict }
      : unreadable
  }
  catch {
    return unreadable
  }
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

  if (session.create === undefined || session.prompt === undefined) {
    return yield* Effect.fail(new Error('subagent-port-unavailable: session.create'))
  }

  if (session.wait === undefined) {
    return yield* Effect.fail(new Error('subagent-port-unavailable: session.wait'))
  }

  const child = yield* session.create({ parentID: request.parentID as Session.ID, agent: request.agent as Agent.ID })
  yield* session.prompt({ sessionID: child.id as Session.ID, text: request.text })

  return readVerdict(replyText(yield* session.wait({ sessionID: child.id as Session.ID })))
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

export interface PluginPorts {
  readonly runShell?: RunShell
  readonly injectSkill?: InjectSkill
  readonly loadMemories?: LoadMemories
  readonly runSubagent?: RunSubagent
  readonly sendCommand?: SendCommand
  readonly machine?: MachineModule
}

export const createStateMachinePlugin = (
  loadLibrary: () => Promise<StateMachineLibrary>,
  ports: PluginPorts = {},
): Plugin => ({
  id: 'opencode.state-machine',
  effect: context => Effect.gen(function* () {
    const runShell = ports.runShell ?? runShellCommand
    const injectSkill: InjectSkill = ports.injectSkill ?? ((sessionId, name) =>
      context.session.prompt({
        sessionID: sessionId as Session.ID,
        text: '',
        skills: [{ id: name as Skill.ID }],
      }).pipe(Effect.asVoid))
    const loadMemories: LoadMemories = ports.loadMemories ?? (namespace => Effect.tryPromise({
      try: () => readMemories(context.location.directory, namespace),
      catch: cause => new Error(String(cause)),
    }).pipe(Effect.flatMap(result => result.ok
      ? Effect.succeed(result.value)
      : Effect.fail(new Error(result.output + ' ' + memoryKey(namespace, 'ref'))))))
    const library = yield* Effect.tryPromise({
      try: () => loadLibrary(),
      catch: cause => new Error(cause instanceof Error ? cause.message : String(cause)),
    }).pipe(
      Effect.tapError(reportFailure('state library failed to load')),
      Effect.orDie,
    )

    const config = readStartConfig(harnessConfig.plugins['state-machine'].startStates)

    for (const agent of config.invalidAgents) {
      yield* Effect.logWarning(
        '[state-machine] agent \'' + agent + '\' names a state the loop does not declare; no machine for it',
      )
    }

    const machine = createStateMachine({
      library,
      machine: ports.machine,
      snapshot: createSnapshotStore({
        load: key => context.storage.get(key),
        save: (key, value) => context.storage.set(key, value as Parameters<Context['storage']['set']>[1]),
      }),
    })

    const sendPrompt = (sessionId: string, text: string, description: string): Effect.Effect<void> =>
      context.session.synthetic({
        sessionID: sessionId as Session.ID,
        text,
        description,
        resume: true,
      }).pipe(
        Effect.asVoid,
        Effect.tapError(reportFailure('emit.prompt failed for session ' + sessionId)),
        Effect.ignore,
      )

    const settle = (sessionId: string, reportTo: CallbackName, payload: CallbackPayload): Effect.Effect<void> =>
      Effect.suspend(() => deliver(sessionId, settleVerdict(
        (session, name, value) => machine.callback(session, name, value),
        subagent.pending(sessionId),
        sessionId,
        reportTo,
        payload,
      ))).pipe(
        Effect.andThen(Effect.suspend(() => persist(sessionId))),
        Effect.ignore,
      )

    const commands = createCommandRunner(context, ports.sendCommand)

    const offerIdle = (sessionId: string): Effect.Effect<void> => Effect.gen(function* () {
      const emits = yield* machine.idle(sessionId)

      yield* deliver(sessionId, emits)
      yield* persist(sessionId)
    })

    const subagent = createSubagentRunner(context, ports.runSubagent)

    const logSnapshot = (sessionId: string, status: string): Effect.Effect<void> =>
      status === 'read-failed'
        ? Effect.logWarning('[state-machine] snapshot state-machine/' + sessionId + ' ' + status)
        : Effect.logDebug('[state-machine] snapshot state-machine/' + sessionId + ' ' + status)

    const persist = (sessionId: string): Effect.Effect<void> =>
      machine.persist(sessionId).pipe(
        Effect.tap(status => status === 'write-failed'
          ? Effect.logWarning('[state-machine] snapshot state-machine/' + sessionId + ' write-failed')
          : Effect.void),
        Effect.asVoid,
        Effect.catchCause(() => Effect.void),
      )

    // The factory's `ensure` takes the session's parentID, which admission reads
    // from the `admit` event; the `StateMachine` type does not declare it.
    const ensureSession: (
      sessionId: string,
      agent: string,
      parentID?: string,
    ) => ReturnType<typeof machine.ensure> = machine.ensure

    const open = (sessionId: string, agent: string, parentID?: string): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const started = yield* ensureSession(sessionId, agent, parentID)

        if (started === undefined) {
          yield* logSnapshot(sessionId, 'read-failed')
          return false
        }

        if (started.snapshot !== undefined && started.snapshot !== 'restored' && started.snapshot !== 'fresh') {
          yield* logSnapshot(sessionId, started.snapshot)
        }

        if (!started.created) return true

        yield* deliver(sessionId, started.emits)
        return true
      })

    const reportCommandRefusal = (sessionId: string, outcome: CommandRaise): Effect.Effect<void> =>
      outcome.ok
        ? Effect.void
        : Effect.logWarning('[state-machine] emit.command refused for session ' + sessionId + ': ' + outcome.output)

    // Signals and commands settle no callback, so they take no payload and are
    // delivered beside the switch rather than as two more cases in it.
    const deliverNotice = (sessionId: string, emitted: SignalsEmit | CommandEmit): Effect.Effect<void> =>
      emitted.type === 'emit.signals'
        ? sendPrompt(sessionId, machine.signalLine(sessionId, emitted.signal_keys), SIGNALS_PROMPT_DESCRIPTION)
        : commands.raise(sessionId, emitted).pipe(
            Effect.tap(result => reportCommandRefusal(sessionId, result)),
            Effect.asVoid,
          )

    const deliverEmit = (
      sessionId: string,
      emitted: Exclude<EmitRequest, SignalsEmit | CommandEmit>,
    ): Effect.Effect<void> =>
      Effect.suspend(() => {
        switch (emitted.type) {
          case 'emit.subagent': {
            return subagent.spawn(sessionId, emitted, payload => settle(sessionId, emitted.reportTo, payload))
          }
          case 'emit.prompt': {
            return sendPrompt(sessionId, emitted.text, promptDescription(emitted))
          }
          case 'emit.dispatch': {
            return settle(sessionId, 'subagent_ready', {
              ok: false,
              output: 'spawn-failed: emit.dispatch is retired in favour of emit.subagent',
            })
          }
          case 'emit.shell': {
            return runShell(emitted.cmd, context.location.directory).pipe(
              Effect.flatMap(payload => settle(sessionId, emitted.reportTo, payload)),
            )
          }
          case 'emit.skill': {
            return injectSkill(sessionId, emitted.name).pipe(
              Effect.match({
                onFailure: cause => ({ ok: false, output: String(cause) }),
                onSuccess: () => ({ ok: true }),
              }),
              Effect.flatMap(payload => settle(sessionId, emitted.reportTo, payload)),
            )
          }
          case 'emit.memories': {
            return loadMemories(emitted.namespace).pipe(
              Effect.match({
                onFailure: cause => ({ ok: false, output: String(cause) }),
                onSuccess: value => ({ ok: true, value }),
              }),
              Effect.flatMap(payload => settle(sessionId, emitted.reportTo, payload)),
            )
          }
        }
      })

    const deliver = (sessionId: string, emits: readonly EmitRequest[]): Effect.Effect<void> =>
      Effect.forEach(
        emits,
        (emitted) => {
          return emitted.type === 'emit.signals' || emitted.type === 'emit.command' ? deliverNotice(sessionId, emitted) : deliverEmit(sessionId, emitted)
        },
        { discard: true },
      )

    yield* context.tool.transform((editor) => {
      editor.add({
        name: SIGNAL_TOOL,
        description: 'Request a transition in this session\'s state machine. A signal the policy does not enable is refused; an accepted one returns "Signal accepted."',
        input: signalInput,
        options: { codemode: true },
        execute: (input, toolContext) =>
          Effect.gen(function* () {
            const sessionId = toolContext.sessionID as unknown as string
            const agent = toolContext.agent as unknown as string | undefined

            if (agent === undefined) return { content: machine.status(sessionId) }

            yield* open(sessionId, agent, yield* parentOf(sessionId))

            const result = machine.signal(input, sessionId)

            if (result.refusal !== undefined) {
              return yield* Effect.fail(new Tool.Error({
                message: result.text,
                metadata: result.refusal as unknown as Record<string, unknown>,
              }))
            }

            yield* deliver(sessionId, result.emits)
            yield* persist(sessionId)

            yield* Effect.sync(() => didCompleteOnSignal(commands, sessionId, signalType(input)))

            return { content: result.text }
          }),
      })
    })

    const parents = new Map<string, string | undefined>()

    const parentOf = (sessionId: string): Effect.Effect<string | undefined> => Effect.suspend(() => {
      return parents.has(sessionId)
        ? Effect.succeed(parents.get(sessionId))
        : context.session.get({ sessionID: sessionId as Session.ID }).pipe(
            Effect.match({
              onFailure: () => {},
              onSuccess: session => (session as { parentID?: unknown }).parentID as string | undefined,
            }),
            Effect.map((parent) => {
              const resolved = typeof parent === 'string' && parent !== '' ? parent : undefined
              parents.set(sessionId, resolved)
              return resolved
            }),
          )
    })

    yield* context.tool.hook('execute.before', payload => Effect.gen(function* () {
      const sessionId = payload.sessionID as unknown as string
      const agent = payload.agent as unknown as string
      const tool = payload.tool as unknown as string

      yield* Effect.logInfo('[state-machine] execute.before tool=' + tool
        + ' keys=' + Object.keys((payload.input ?? {}) as Record<string, unknown>).join(','))

      if ((agent !== GATE_AGENT) || ((yield* parentOf(sessionId)) !== undefined)) return

      yield* open(sessionId, agent, yield* parentOf(sessionId))

      const decision = decide({ agent, isChild: false, state: machine.state(sessionId), policy: machine.policy(sessionId), tool })

      if (!decision.allowed) {
        return yield* Effect.fail(new Tool.Error({
          message: decision.message,
          metadata: {
            code: 'tool_blocked',
            tool,
            state: machine.state(sessionId),
            allowed_tools: machine.policy(sessionId)?.allowedTools ?? [],
          },
        }))
      }
    }))

    yield* context.event.subscribe().pipe(
      Stream.filter((event): event is Extract<PluginEvent, { type: 'session.created' }> =>
        event.type === 'session.created',
      ),
      Stream.runForEach(event => Effect.gen(function* () {
        const sessionId = event.data.sessionID as unknown as string
        const agent = event.data.agent as string | undefined

        if (agent === undefined) return

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
        const session = yield* context.session.get({ sessionID: sessionId as Session.ID })
        const agent = session.agent as unknown as string | undefined

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

        const session = yield* context.session.get({ sessionID: event.data.sessionID })
        const agent = session.agent as unknown as string | undefined

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
  }),
})

/**
A verdict is delivered only while its spawn is in flight; one that arrives with
no pending spawn is dropped, with no transition and nothing recorded.
*/
export const settleVerdict = (
  callback: (sessionId: string, reportTo: CallbackName, payload: CallbackPayload) => readonly EmitRequest[],
  pendingSpawn: string | undefined,
  sessionId: string,
  reportTo: CallbackName,
  payload: CallbackPayload,
): readonly EmitRequest[] =>
  reportTo === 'subagent_ready' && pendingSpawn === undefined
    ? []
    : callback(sessionId, reportTo, payload)

export default createStateMachinePlugin(loadStateMachineLibrary)
