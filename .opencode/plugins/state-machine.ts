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
import { Cause, Effect } from 'effect'
import type { JsonSchema } from 'effect'
import type { Context, Plugin } from '@opencode/plugin/effect/plugin'
import type { Session } from '@opencode/schema/session'
import type { Skill } from '@opencode/schema/skill'
import { Tool } from '@opencode/schema/tool'

import { harnessConfig } from './config/harness'
import { createSnapshotStore } from './state-machine/core/snapshot'
import { appendSynthetic } from './helpers/session/synthetic-append'
import { createSessionReader } from './helpers/session/read'
import { memoryKey, readMemories } from './state-machine/core/memory'
import {
  createStateMachine,
  loadStateMachineLibrary,
  MachineUnavailable,
  readStartConfig,
} from './state-machine/core/machine'
import type { MachineModule } from './state-machine/machines'
import type {
  CallbackName,
  CallbackPayload,
  CommandEmit,
  EmitRequest,
  InjectSkill,
  LoadMemories,
  MachineHandle,
  RunShell,
  SignalsEmit,
  StateMachine,
  StateMachineLibrary,
} from './state-machine/core/machine'
import { reportFailure, runShellCommand } from './state-machine/ports/shell-port'
import { causeText } from './state-machine/ports/cause-text'
import { createSubagentRunner, UNREADABLE_VERDICT_PREFIX } from './state-machine/ports/subagent-port'
import type { RunSubagent } from './state-machine/ports/subagent-port'
import { createCommandRunner, didCompleteOnSignal } from './state-machine/ports/command-port'
import type { CommandRaise, SendCommand } from './state-machine/ports/command-port'
import { registerSessionEvents } from './state-machine/events/session-events'
import { createEmitDelivery } from './state-machine/hooks/emit-delivery'
import type { DeliverableEmit } from './state-machine/hooks/emit-delivery'
import { createExecuteBeforeHook } from './state-machine/hooks/execute-before'

export { createSubagentRunner } from './state-machine/ports/subagent-port'
export type { RunSubagent, SubagentRunner } from './state-machine/ports/subagent-port'
export { createCommandRunner, didCompleteOnSignal } from './state-machine/ports/command-port'
export type { CommandRaise, CommandRequest, CommandRunner, SendCommand } from './state-machine/ports/command-port'

const SIGNAL_TOOL = 'signal_send'
const SIGNALS_PROMPT_DESCRIPTION = 'The session loop is listing the signals the policy enables.'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

const orDefault = <Value>(supplied: Value | undefined, otherwise: Value): Value => supplied ?? otherwise

const commandRefusalLine = (name: string, reason: string): string =>
  'The `' + name + '` command was refused (' + reason + '), so this stage cannot advance until it runs.'

const unreadableVerdictLine = (detail: string): string =>
  'The validator reply was unreadable, so its verdict was dropped and recorded as a failure: ' + detail
const COMMAND_REFUSAL_PROMPT_DESCRIPTION = 'A stage command was refused and the loop cannot advance.'
const UNREADABLE_VERDICT_PROMPT_DESCRIPTION = 'A validator reply was unreadable and its verdict was dropped.'

/**
The host may refuse a command after the raise has returned, when no completion
signal will ever arrive; the failure is reported to the session rather than only
logged, still failing so the runner clears its pending entry.
*/
const hostCommandPort = (context: Context): SendCommand | undefined => {
  const host = (context.session as unknown as { readonly command?: SendCommand }).command
  return host === undefined ? undefined : request => host({ ...request, sessionID: request.sessionID as Session.ID })
}

const observedCommandPort = (
  context: Context,
  supplied: SendCommand | undefined,
  prompt: (sessionId: string, name: string, reason: string) => Effect.Effect<void>,
): SendCommand | undefined => {
  const send = supplied ?? hostCommandPort(context)
  return send === undefined
    ? undefined
    : request => send(request).pipe(
      Effect.tapError(cause => prompt(request.sessionID, request.name, causeText(cause))),
    )
}

const signalType = (input: unknown): unknown => (isRecord(input) ? input.type : undefined)

const isQuietSnapshot = (status: string | undefined): boolean =>
  status === undefined || ['restored', 'fresh'].includes(status)

const warnLine = (path: string, sessionId: string, reason: string): string =>
  '[state-machine] ' + path + ' ' + sessionId + ': ' + reason

const unavailableLine = (failure: MachineUnavailable): string =>
  failure.detail === undefined ? failure.reason : failure.reason + ' (' + failure.detail + ')'

const logUnavailable = (path: string, failure: MachineUnavailable): Effect.Effect<void> =>
  Effect.logWarning(warnLine(path, failure.sessionId, unavailableLine(failure)))

const toolUnavailable = (failure: MachineUnavailable): Effect.Effect<never, Tool.Error> => {
  const reason = unavailableLine(failure)
  const error = new Tool.Error({
    message: 'No state machine for this session: ' + reason + '.',
    metadata: { code: 'machine_unavailable', session: failure.sessionId, reason: failure.reason },
  })

  return logUnavailable('tool', failure).pipe(Effect.andThen(Effect.fail(error)))
}

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

export interface PluginPorts {
  readonly runShell?: RunShell
  readonly injectSkill?: InjectSkill
  readonly loadMemories?: LoadMemories
  readonly runSubagent?: RunSubagent
  readonly sendCommand?: SendCommand
  readonly machine?: MachineModule
}

const warnInvalidAgents = (agents: readonly string[]): Effect.Effect<void> =>
  Effect.gen(function* () {
    for (const agent of agents) {
      yield* Effect.logWarning(
        '[state-machine] agent \'' + agent + '\' names a state the loop does not declare; no machine for it',
      )
    }
  })

export const createStateMachinePlugin = (
  loadLibrary: () => Promise<StateMachineLibrary>,
  ports: PluginPorts = {},
): Plugin => ({
  id: 'opencode.state-machine',
  effect: context => Effect.gen(function* () {
    const runShell: RunShell = orDefault(ports.runShell, runShellCommand)
    const injectSkill: InjectSkill = orDefault(ports.injectSkill, (sessionId, name) =>
      context.session.prompt({
        sessionID: sessionId as Session.ID,
        text: '',
        skills: [{ id: name as Skill.ID }],
      }).pipe(Effect.asVoid))
    const loadMemories: LoadMemories = orDefault(ports.loadMemories, namespace => Effect.tryPromise({
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

    yield* warnInvalidAgents(config.invalidAgents)

    const machine = createStateMachine({
      library,
      machine: ports.machine,
      snapshot: createSnapshotStore({
        load: key => context.storage.get(key),
        save: (key, value) => context.storage.set(key, value as Parameters<Context['storage']['set']>[1]),
      }),
    })

    const sendPrompt = (sessionId: string, text: string, description: string): Effect.Effect<void> =>
      appendSynthetic(
        context.session.synthetic({
          sessionID: sessionId as Session.ID,
          text,
          description,
          resume: true,
        }),
        { _tag: 'report', onFailure: reportFailure('emit.prompt failed for session ' + sessionId) },
      ).pipe(Effect.asVoid)

    const promptCommandRefusal = (sessionId: string, name: string, reason: string): Effect.Effect<void> =>
      sendPrompt(sessionId, commandRefusalLine(name, reason), COMMAND_REFUSAL_PROMPT_DESCRIPTION)

    const reportUnreadableVerdict = (sessionId: string, payload: CallbackPayload): Effect.Effect<void> => {
      const output = payload.output ?? ''

      return output.startsWith(UNREADABLE_VERDICT_PREFIX)
        ? sendPrompt(sessionId, unreadableVerdictLine(output), UNREADABLE_VERDICT_PROMPT_DESCRIPTION)
        : Effect.void
    }

    // A verdict answers a spawn that is in flight; it starts no transition of
    // its own, so a session with no machine drops it loudly.
    const settle = (sessionId: string, reportTo: CallbackName, payload: CallbackPayload): Effect.Effect<void> =>
      machine.access(sessionId, undefined).pipe(
        Effect.flatMap((handle) => {
          const pending = subagent.pending(sessionId)
          const isDropped = reportTo === 'subagent_ready' && pending === undefined
          const verdicts = settleVerdict(
            (_session, name, value) => handle.callback(name, value),
            pending,
            sessionId,
            reportTo,
            payload,
          )

          return (isDropped
            ? Effect.logWarning(warnLine('verdict', sessionId, 'subagent_ready dropped, no spawn in flight'))
            : Effect.void).pipe(
            Effect.andThen(deliver(sessionId, verdicts)),
            Effect.andThen(reportUnreadableVerdict(sessionId, payload)),
            Effect.andThen(persistHandle(handle)),
          )
        }),
        Effect.catchTag('MachineUnavailable', failure => logUnavailable('verdict', failure)),
      )

    const commands = createCommandRunner(context, observedCommandPort(context, ports.sendCommand, promptCommandRefusal))

    const offerIdle = (sessionId: string): Effect.Effect<void> =>
      machine.access(sessionId, undefined).pipe(
        Effect.flatMap(handle => handle.idle().pipe(
          Effect.flatMap(emits => deliver(sessionId, emits)),
          Effect.andThen(persistHandle(handle)),
        )),
        Effect.catchTag('MachineUnavailable', failure => logUnavailable('idle', failure)),
      )

    const subagent = createSubagentRunner(context, ports.runSubagent)

    const logSnapshot = (sessionId: string, status: string | undefined): Effect.Effect<void> => {
      if (isQuietSnapshot(status)) return Effect.void

      const line = '[state-machine] snapshot state-machine/' + sessionId + ' ' + status
      return status === 'read-failed' ? Effect.logWarning(line) : Effect.logDebug(line)
    }

    const reportPersist = (sessionId: string, status: 'written' | 'skipped' | 'write-failed'): Effect.Effect<void> =>
      status === 'written' ? Effect.void : Effect.logWarning(warnLine('persist', sessionId, status))

    const persistHandle = (handle: MachineHandle): Effect.Effect<void> =>
      handle.persist().pipe(
        // The factory logs its own `skipped`; only a rejected write is reported
        // here, because the caller is the one that can name it without a cause.
        Effect.tap(status => status === 'write-failed'
          ? Effect.logWarning(warnLine('persist', handle.sessionId, status))
          : Effect.void),
        Effect.asVoid,
      )

    // An event can arrive for a session with no entry: there is nothing to
    // save, and the skip is a fact the log carries rather than swallows.
    const persist = (sessionId: string): Effect.Effect<void> =>
      machine.access(sessionId, undefined).pipe(
        Effect.flatMap(handle => persistHandle(handle)),
        Effect.catchTag('MachineUnavailable', () => reportPersist(sessionId, 'skipped')),
      )

    // The factory's `ensure` takes the session's parentID, which admission reads
    // from the `admit` event; the `StateMachine` type does not declare it.
    const ensureSession: (
      sessionId: string,
      agent: string,
      parentID?: string,
    ) => ReturnType<typeof machine.ensure> = machine.ensure

    // `open` goes through `access`, so a rejected read keeps its typed reason
    // (`read-failed` with its detail, `no-identity`) instead of collapsing to an
    // untyped empty result.
    const open = (sessionId: string, agent: string, parentID?: string): Effect.Effect<boolean> =>
      machine.access(sessionId, { agent, parentID }).pipe(
        Effect.as(true),
        Effect.catchTag('MachineUnavailable', failure => logUnavailable('open', failure).pipe(Effect.as(false))),
      )

    const reportCommandRefusal = (sessionId: string, emitted: CommandEmit, outcome: CommandRaise): Effect.Effect<void> =>
      outcome.ok
        ? Effect.void
        : Effect.logWarning('[state-machine] emit.command refused for session ' + sessionId + ': ' + outcome.output).pipe(
            Effect.andThen(promptCommandRefusal(sessionId, emitted.name, outcome.output)),
          )

    // Signals and commands settle no callback, so they take no payload and are
    // delivered beside the switch rather than as two more cases in it.
    const deliverNotice = (sessionId: string, emitted: SignalsEmit | CommandEmit): Effect.Effect<void> =>
      emitted.type === 'emit.signals'
        ? machine.access(sessionId, undefined).pipe(
            Effect.flatMap(handle => sendPrompt(sessionId, handle.signalLine(emitted.signal_keys), SIGNALS_PROMPT_DESCRIPTION)),
            Effect.catchTag('MachineUnavailable', failure => logUnavailable('signals', failure)),
          )
        : commands.raise(sessionId, emitted).pipe(
            Effect.tap(result => reportCommandRefusal(sessionId, emitted, result)),
            Effect.asVoid,
          )

    const deliverEmit: (sessionId: string, emitted: DeliverableEmit) => Effect.Effect<void>
      = createEmitDelivery({
        directory: context.location.directory,
        runShell,
        injectSkill,
        loadMemories,
        subagent,
        sendPrompt,
        settle,
      })

    // One emit failing names itself and its cause; the rest of the batch still
    // runs, because a prompt the host refused must not drop the skill after it.
    const deliverOne = (sessionId: string, emitted: EmitRequest): Effect.Effect<void> =>
      (emitted.type === 'emit.signals' || emitted.type === 'emit.command'
        ? deliverNotice(sessionId, emitted)
        : deliverEmit(sessionId, emitted)).pipe(
        Effect.catchCause(cause => Effect.logWarning(
          warnLine('emit', sessionId, emitted.type + ' failed cause=' + Cause.pretty(cause)),
        )),
      )

    const deliver = (sessionId: string, emits: readonly EmitRequest[]): Effect.Effect<void> =>
      Effect.forEach(emits, emitted => deliverOne(sessionId, emitted), { discard: true })

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
            const parentID = yield* parentOf(sessionId).pipe(
              Effect.catchCause(() => toolUnavailable(new MachineUnavailable({ sessionId, reason: 'read-failed' }))),
            )
            const handle = yield* (agent === undefined
              ? toolUnavailable(new MachineUnavailable({ sessionId, reason: 'no-identity' }))
              : machine.access(sessionId, { agent, parentID }).pipe(
                  Effect.catchTag('MachineUnavailable', failure => toolUnavailable(failure)),
                ))

            const result = handle.signal(input)

            if (result.refusal !== undefined) {
              return yield* Effect.fail(new Tool.Error({
                message: result.text,
                metadata: result.refusal as unknown as Record<string, unknown>,
              }))
            }

            yield* deliver(sessionId, result.emits)
            yield* persistHandle(handle)

            yield* Effect.sync(() => didCompleteOnSignal(commands, sessionId, signalType(input)))

            return { content: result.text }
          }),
      })
    })

    const sessionReader = createSessionReader(context)

    // A session's parent id never changes, so the reader's cache is safe here;
    // the mode is named at the call rather than decided by the helper.
    // A failed read is not "no parent": the hook blocks on the failure instead
    // of gating a child session as a root, and the line says which read failed.
    const parentOf = (sessionId: string): Effect.Effect<string | undefined, unknown> =>
      sessionReader.read(sessionId, 'cached').pipe(
        Effect.map(identity => identity.parentID),
        Effect.catchCause(cause => Effect.flatMap(
          Effect.logWarning('[state-machine] parent ' + sessionId + ': read-failed'),
          () => Effect.failCause(cause),
        )),
      )

    const handleExecuteBefore = createExecuteBeforeHook({ machine, open, parentOf })

    yield* context.tool.hook('execute.before', payload => handleExecuteBefore({
      sessionId: payload.sessionID as unknown as string,
      agent: payload.agent as unknown as string,
      tool: payload.tool as unknown as string,
      input: payload.input,
    }))

    // An event that finds no machine has nothing to save and returns before its
    // own `persist` call, so the skip is reported where the machine was refused
    // and the log still says why nothing was written.
    const eventMachine: Pick<StateMachine, 'access'> = {
      access: (sessionId: string, identity: Parameters<StateMachine['access']>[1]) =>
        machine.access(sessionId, identity).pipe(
          Effect.tapError(failure => failure.reason === 'no-identity'
            ? reportPersist(sessionId, 'skipped')
            : Effect.void),
        ),
    }

    yield* registerSessionEvents({
      context,
      machine: eventMachine,
      open,
      ensureSession,
      parentOf,
      logSnapshot,
      deliver,
      persist,
      offerIdle,
    })
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
