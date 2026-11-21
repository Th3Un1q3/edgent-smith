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
  loadStateMachineLibrary,
  promptDescription,
  readStartConfig,
} from './state-machine/core/machine'
import type {
  CallbackName,
  CallbackPayload,
  EmitRequest,
  InjectSkill,
  InterruptReason,
  LoadMemories,
  RunShell,
  StateMachineLibrary,
} from './state-machine/core/machine'

const SIGNAL_TOOL = 'signal_send'
const SHELL_TIMEOUT_MS = 120_000
const SHELL_MAX_BUFFER = 4 * 1024 * 1024
const SIGNALS_PROMPT_DESCRIPTION = 'The session loop is listing the signals the policy enables.'

type PluginEvent = Stream.Success<ReturnType<Context['event']['subscribe']>>

const interruptReason = (value: unknown): InterruptReason | undefined =>
  typeof value === 'string' ? INTERRUPT_REASONS.find(reason => reason === value) : undefined

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
export interface PluginPorts {
  readonly runShell?: RunShell
  readonly injectSkill?: InjectSkill
  readonly loadMemories?: LoadMemories
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
      Effect.suspend(() => deliver(sessionId, machine.callback(sessionId, reportTo, payload))).pipe(
        Effect.andThen(Effect.suspend(() => persist(sessionId))),
        Effect.ignore,
      )

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

    /**
    Starts a validator child and prompts it. A child's signals never reach the
    parent, so this reports nothing; a failure returns false for the fallback.
    */
    const startValidator = (sessionId: string, agent: string, text: string): Effect.Effect<boolean> =>
      Effect.gen(function* () {
        const exists = yield* context.agent.get({ agentID: agent as Agent.ID }).pipe(
          Effect.as(true),
          Effect.catchCause(() => Effect.succeed(false)),
        )

        if (!exists) return false

        const child = yield* context.session.create({
          parentID: sessionId as Session.ID,
          agent: agent as Agent.ID,
        })

        yield* context.session.prompt({ sessionID: child.id, text })
        return true
      }).pipe(Effect.catchCause(() => Effect.succeed(false)))

    const deliver = (sessionId: string, emits: readonly EmitRequest[]): Effect.Effect<void> =>
      Effect.forEach(
        emits,
        emitted => Effect.suspend(() => {
          switch (emitted.type) {
            case 'emit.prompt': {
              return sendPrompt(sessionId, emitted.text, promptDescription(emitted))
            }
            case 'emit.dispatch': {
              return startValidator(sessionId, emitted.agent, emitted.text).pipe(
                Effect.flatMap(started => started
                  ? Effect.void
                  : sendPrompt(sessionId, emitted.text, promptDescription(emitted))),
              )
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
            case 'emit.signals': {
              return sendPrompt(
                sessionId,
                machine.signalLine(sessionId, emitted.signal_keys),
                SIGNALS_PROMPT_DESCRIPTION,
              )
            }
          }
        }),
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

        const emits = yield* machine.idle(sessionId)

        yield* deliver(sessionId, emits)
        yield* persist(sessionId)
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

export default createStateMachinePlugin(loadStateMachineLibrary)
