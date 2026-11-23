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
import { Effect } from 'effect'
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
  RunShell,
  SignalsEmit,
  StateMachineLibrary,
} from './state-machine/core/machine'
import { reportFailure, runShellCommand } from './state-machine/ports/shell-port'
import { createSubagentRunner } from './state-machine/ports/subagent-port'
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

const signalType = (input: unknown): unknown => (isRecord(input) ? input.type : undefined)

const isQuietSnapshot = (status: string | undefined): boolean =>
  status === undefined || ['restored', 'fresh'].includes(status)

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

    const logSnapshot = (sessionId: string, status: string | undefined): Effect.Effect<void> => {
      if (isQuietSnapshot(status)) return Effect.void

      const line = '[state-machine] snapshot state-machine/' + sessionId + ' ' + status
      return status === 'read-failed' ? Effect.logWarning(line) : Effect.logDebug(line)
    }

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

        yield* logSnapshot(sessionId, started.snapshot)

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

    const sessionReader = createSessionReader(context)

    // A session's parent id never changes, so the reader's cache is safe here;
    // the mode is named at the call rather than decided by the helper.
    const parentOf = (sessionId: string): Effect.Effect<string | undefined> =>
      sessionReader.read(sessionId, 'cached').pipe(
        Effect.map(identity => identity.parentID),
        Effect.orElseSucceed<string | undefined>(() => {}),
      )

    const handleExecuteBefore = createExecuteBeforeHook({ machine, open, parentOf })

    yield* context.tool.hook('execute.before', payload => handleExecuteBefore({
      sessionId: payload.sessionID as unknown as string,
      agent: payload.agent as unknown as string,
      tool: payload.tool as unknown as string,
      input: payload.input,
    }))

    yield* registerSessionEvents({
      context,
      machine,
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
