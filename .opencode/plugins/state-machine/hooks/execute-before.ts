import { Effect } from 'effect'
import { Tool } from '@opencode/schema/tool'

import type { StateMachine } from '../core/machine'
import { decide, GATE_AGENT } from '../core/policy'

export interface ExecuteBeforeRequest {
  readonly sessionId: string
  readonly agent: string
  readonly tool: string
  readonly input: unknown
}

export interface ExecuteBeforePorts {
  readonly machine: StateMachine
  readonly open: (sessionId: string, agent: string, parentID?: string) => Effect.Effect<boolean>
  readonly parentOf: (sessionId: string) => Effect.Effect<string | undefined>
}

const logExecuteBefore = (tool: string, input: unknown): Effect.Effect<void> =>
  Effect.logInfo('[state-machine] execute.before tool=' + tool
    + ' keys=' + Object.keys((input ?? {}) as Record<string, unknown>).join(','))

const blockedToolError = (machine: StateMachine, sessionId: string, tool: string, message: string): Tool.Error =>
  new Tool.Error({
    message,
    metadata: {
      code: 'tool_blocked',
      tool,
      state: machine.state(sessionId),
      allowed_tools: machine.policy(sessionId)?.allowedTools ?? [],
    },
  })

const rejectIfDenied = (
  decision: ReturnType<typeof decide>,
  machine: StateMachine,
  sessionId: string,
  tool: string,
): Effect.Effect<void, Tool.Error> =>
  decision.allowed ? Effect.void : Effect.fail(blockedToolError(machine, sessionId, tool, decision.message))

export const createExecuteBeforeHook = (ports: ExecuteBeforePorts) =>
  (request: ExecuteBeforeRequest): Effect.Effect<void, Tool.Error> => Effect.gen(function* () {
    const { sessionId, agent, tool } = request

    yield* logExecuteBefore(tool, request.input)

    // A child session's tools are the child machine's business, so the host call
    // that resolves the parent is skipped for every other agent.
    if (agent !== GATE_AGENT) return

    const parentID = yield* ports.parentOf(sessionId)

    if (parentID !== undefined) return

    yield* ports.open(sessionId, agent, parentID)

    const decision = decide({
      agent,
      isChild: false,
      state: ports.machine.state(sessionId),
      policy: ports.machine.policy(sessionId),
      tool,
    })

    yield* rejectIfDenied(decision, ports.machine, sessionId, tool)
  })
