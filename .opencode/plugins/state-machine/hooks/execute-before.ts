import { Effect, Exit, Option } from 'effect'
import { Tool } from '@opencode/schema/tool'

import type { MachineHandle, MachineUnavailable, SessionIdentity, StateMachine } from '../core/machine'
import { decide, GATE_AGENT, UNAVAILABLE_STATE, unavailableMessage } from '../core/policy'
import type { GateDecision } from '../core/policy'

const HOOK_PATH = 'execute.before'

export interface ExecuteBeforeRequest {
  readonly sessionId: string
  readonly agent: string
  readonly tool: string
  readonly input: unknown
}

export interface ExecuteBeforePorts {
  readonly machine: StateMachine
  /**
   * The hook reads the machine through `access`; the registration still builds
   * this port, so it stays declared until that surface is reduced.
   */
  readonly open: (sessionId: string, agent: string, parentID?: string) => Effect.Effect<boolean>
  /**
   * A failure means the parent read failed, which is not the same fact as "no
   * parent": the gate must not fold the two together.
   */
  readonly parentOf: (sessionId: string) => Effect.Effect<string | undefined, unknown>
}

type ParentRead
  = | { readonly kind: 'child' }
    | { readonly kind: 'root' }
    | { readonly kind: 'unreadable' }

const warn = (sessionId: string, reason: string): Effect.Effect<void> =>
  Effect.logWarning('[state-machine] ' + HOOK_PATH + ' ' + sessionId + ': ' + reason)

const logExecuteBefore = (tool: string, input: unknown): Effect.Effect<void> =>
  Effect.logInfo('[state-machine] ' + HOOK_PATH + ' tool=' + tool
    + ' keys=' + Object.keys((input ?? {}) as Record<string, unknown>).join(','))

const blockedToolError = (
  tool: string,
  message: string,
  state: string,
  allowedTools: readonly string[],
): Tool.Error =>
  new Tool.Error({
    message,
    metadata: {
      code: 'tool_blocked',
      tool,
      state,
      allowed_tools: allowedTools,
    },
  })

/**
 * One warning naming the session and the reason, then a block. The log comes
 * first so the operator sees the cause even when the refusal ends the hook.
 */
const blockUnavailable = (sessionId: string, tool: string, reason: string): Effect.Effect<never, Tool.Error> =>
  Effect.flatMap(
    warn(sessionId, reason),
    () => Effect.fail(blockedToolError(tool, unavailableMessage(tool, reason), UNAVAILABLE_STATE, [])),
  )

const reasonOf = (exit: Exit.Exit<MachineHandle, MachineUnavailable>): string => {
  const found = Exit.findErrorOption(exit)

  return Option.isNone(found) ? 'unreadable' : found.value.reason
}

const handleOutcome = (
  sessionId: string,
  tool: string,
  exit: Exit.Exit<MachineHandle, MachineUnavailable>,
): Effect.Effect<MachineHandle, Tool.Error> =>
  Exit.isSuccess(exit)
    ? Effect.succeed(exit.value)
    : blockUnavailable(sessionId, tool, reasonOf(exit))

const handleOrBlock = (
  machine: StateMachine,
  sessionId: string,
  tool: string,
  identity: SessionIdentity,
): Effect.Effect<MachineHandle, Tool.Error> =>
  Effect.flatMap(
    Effect.exit(machine.access(sessionId, identity)),
    exit => handleOutcome(sessionId, tool, exit),
  )

const allowedToolsOf = (handle: MachineHandle): readonly string[] => handle.policy?.allowedTools ?? []

const rejectIfDenied = (decision: GateDecision, handle: MachineHandle, tool: string): Effect.Effect<void, Tool.Error> =>
  decision.allowed
    ? Effect.void
    : Effect.flatMap(
        warn(handle.sessionId, decision.message),
        () => Effect.fail(blockedToolError(tool, decision.message, handle.state, allowedToolsOf(handle))),
      )

const runGate = (machine: StateMachine, request: ExecuteBeforeRequest): Effect.Effect<void, Tool.Error> =>
  Effect.gen(function* () {
    const identity: SessionIdentity = { agent: request.agent }
    const handle = yield* handleOrBlock(machine, request.sessionId, request.tool, identity)

    // A handle with no policy would refuse with an empty allowlist, so the
    // absent policy is named before the decision rather than inferred from [].
    if (handle.policy === undefined) yield* warn(handle.sessionId, 'no-policy')

    const decision = decide({
      agent: request.agent,
      isChild: false,
      state: handle.state,
      policy: handle.policy,
      tool: request.tool,
    })

    return yield* rejectIfDenied(decision, handle, request.tool)
  })

/**
 * A child session's tools are the child machine's business; an unreadable
 * parent is not a child, so the gate blocks instead of guessing.
 */
const gateForParent = (
  machine: StateMachine,
  request: ExecuteBeforeRequest,
  parent: ParentRead,
): Effect.Effect<void, Tool.Error> => {
  if (parent.kind === 'child') return Effect.void
  return parent.kind === 'unreadable' ? blockUnavailable(request.sessionId, request.tool, 'parent-unreadable') : runGate(machine, request)
}

const readParent = (parentOf: ExecuteBeforePorts['parentOf'], sessionId: string): Effect.Effect<ParentRead> =>
  parentOf(sessionId).pipe(
    Effect.map((parentID): ParentRead => ({ kind: parentID === undefined ? 'root' : 'child' })),
    Effect.catchCause(() => Effect.succeed<ParentRead>({ kind: 'unreadable' })),
  )

export const createExecuteBeforeHook = (ports: ExecuteBeforePorts) =>
  (request: ExecuteBeforeRequest): Effect.Effect<void, Tool.Error> => Effect.gen(function* () {
    yield* logExecuteBefore(request.tool, request.input)

    // A child session's tools are the child machine's business, so the host call
    // that resolves the parent is skipped for every other agent.
    if (request.agent !== GATE_AGENT) return

    const parent = yield* readParent(ports.parentOf, request.sessionId)

    return yield* gateForParent(ports.machine, request, parent)
  })
