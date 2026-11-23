import type { LoopContext, LoopEvent } from '../../core/machine'

import type {
  CounterBelowParameters,
  FieldPresentParameters,
  GuardType,
  SessionAgentParameters,
  XStateRuntime,
} from './definition-contract'
import { readCallback, readPayloadField } from './payload-readers'

type AdmissionIdentity = { readonly agent: string, readonly parentID?: string | undefined }

/**
The `admit` event carries the identity a session created before its agent was
known does not hold yet; any other event reads the context's copy.
*/
const identityOf = (context: LoopContext, event: LoopEvent): AdmissionIdentity =>
  event.type === 'admit'
    ? { agent: event.agent, parentID: event.parentID }
    : { agent: context.agent, parentID: context.parentID }

export const createGuards = (runtime: XStateRuntime) => ({
  counter_below: ({ context }: { context: LoopContext }, parameters: CounterBelowParameters) => {
    const limit = typeof parameters.limit === 'number'
      ? parameters.limit
      : context[parameters.limit.fromContext]

    return context[parameters.key] < limit
  },
  field_present: ({ event }: { event: LoopEvent }, parameters: FieldPresentParameters) =>
    readPayloadField(event, parameters.field).trim() !== '',
  /**
  The LESSON schema has already refused blank text, so only the intent decides
  whether this lesson improves the loop or starts another attempt.
  */
  improvement_lesson: ({ context }: { context: LoopContext }) => context.intent === 'improvement',
  callback_ok: ({ event }: { event: LoopEvent }) => readCallback(event).ok,
  /**
  The id, not the leaf: a bare `parked` is compared against the whole state value,
  which is `{ towards_goal: 'parked' }` once parked sits under the compound.
  */
  not_parked: runtime.not(runtime.stateIn('#session.towards_goal.parked')),
  /**
  A session a subagent created never loops, whatever agent id it runs, so the
  parent check joins the allowlist rather than replacing it.
  */
  session_agent: ({ context, event }: { context: LoopContext, event: LoopEvent }, parameters: SessionAgentParameters) => {
    const { agent, parentID } = identityOf(context, event)

    return agent !== ''
      && parameters.in.includes(agent)
      && ['', undefined].includes(parentID)
  },
}) satisfies Record<GuardType, unknown>
