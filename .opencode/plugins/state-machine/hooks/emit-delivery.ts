import { Effect } from 'effect'

import { promptDescription } from '../core/machine'
import type {
  CallbackName,
  CallbackPayload,
  CommandEmit,
  EmitRequest,
  LoadMemories,
  RunShell,
  SignalsEmit,
} from '../core/machine'
import type { SubagentRunner } from '../ports/subagent-port'

export type DeliverableEmit = Exclude<EmitRequest, SignalsEmit | CommandEmit>

type EmitHandler = (sessionId: string, emitted: DeliverableEmit) => Effect.Effect<void>

type EmitHandlers = {
  readonly [K in DeliverableEmit['type']]: (
    sessionId: string,
    emitted: Extract<DeliverableEmit, { readonly type: K }>,
  ) => Effect.Effect<void>
}

export interface EmitDeliveryPorts {
  readonly directory: string
  readonly runShell: RunShell
  readonly loadMemories: LoadMemories
  readonly subagent: SubagentRunner
  readonly sendPrompt: (sessionId: string, text: string, description: string, skills?: readonly string[]) => Effect.Effect<void>
  readonly settle: (sessionId: string, reportTo: CallbackName, payload: CallbackPayload) => Effect.Effect<void>
}

/**
One entry per emit the plugin delivers as work. `signals` and `command` are absent:
they settle no callback and are delivered beside this table.
*/
const emitHandlers = (ports: EmitDeliveryPorts): EmitHandlers => ({
  'emit.subagent': (sessionId, emitted) =>
    ports.subagent.spawn(sessionId, emitted, payload => ports.settle(sessionId, emitted.reportTo, payload)),
  'emit.prompt': (sessionId, emitted) =>
    ports.sendPrompt(sessionId, emitted.text, promptDescription(emitted), emitted.skills),
  'emit.dispatch': sessionId =>
    ports.settle(sessionId, 'subagent_ready', {
      ok: false,
      output: 'spawn-failed: emit.dispatch is retired in favour of emit.subagent',
    }),
  'emit.shell': (sessionId, emitted) =>
    ports.runShell(emitted.cmd, ports.directory).pipe(
      Effect.flatMap(payload => ports.settle(sessionId, emitted.reportTo, payload)),
    ),
  'emit.memories': (sessionId, emitted) =>
    ports.loadMemories(emitted.namespace).pipe(
      Effect.match({
        onFailure: cause => ({ ok: false, output: String(cause) }),
        onSuccess: value => ({ ok: true, value }),
      }),
      Effect.flatMap(payload => ports.settle(sessionId, emitted.reportTo, payload)),
    ),
})

/**
Delivers one emit by its tag. The table's entries each narrow their own emit, so
indexing it yields the union of those handlers: the assertion widens the entry back
to the delivery signature, and the entry narrows its parameter again at the call.
*/
export const createEmitDelivery = (ports: EmitDeliveryPorts): EmitHandler => {
  const handlers = emitHandlers(ports)

  return (sessionId, emitted) => Effect.suspend(() => {
    const handler = handlers[emitted.type] as EmitHandler

    return handler(sessionId, emitted)
  })
}
