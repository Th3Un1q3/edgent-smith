/**
 * Adapts the OpenCode v2 plugin session domain to the V1-shaped
 * WorkflowSdkClient the workflow runner expects.
 *
 * V2 differences handled here:
 *   - prompt admits + wakes (no blocking reply): set agent + model, admit,
 *     wait, then read the assistant text from context. The runner's
 *     per-subtask timer still bounds it.
 *   - messages -> context; V2 messages are flat (type, content, model), so each
 *     is mapped to the V1 { info: { providerID, modelID } } shape that the
 *     runner's model-inheritance reads.
 *   - the inherited parent model is applied through switchModel, mapping the
 *     runner's { providerID, modelID } onto V2 Model.Ref { id, providerID }.
 *   - abort -> interrupt.
 *   - fork is absent from the plugin session domain, so it resolves the service
 *     client lazily and calls the v2 `session.fork({ sessionID })`. With no
 *     boundary the server forks at the source session's latest message. Lazy
 *     resolution keeps a fork failure from breaking the non-fork paths.
 */
import { Effect } from 'effect'
import type { Context } from '@opencode/plugin/effect/plugin'
import { getClient } from './service-client'
import type { WorkflowSdkClient } from './workflow-types'

type Session = Context['session']

const run = <A, E>(effect: Effect.Effect<A, E>): Promise<A> => Effect.runPromise(effect as Effect.Effect<A, never>)

interface ContentPart {
  type?: string
  text?: string
}

interface V2Message {
  type?: string
  content?: ContentPart[]
  model?: { id?: string, providerID?: string }
  error?: unknown
}

const lastAssistant = (messages: ReadonlyArray<unknown>): V2Message | undefined => {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index] as V2Message
    if (message?.type === 'assistant') return message
  }
  return undefined
}

const assistantTextParts = (messages: ReadonlyArray<unknown>): Array<{ type: string, text: string }> =>
  (lastAssistant(messages)?.content ?? [])
    .filter((part): part is { type: string, text: string } => part.type === 'text' && typeof part.text === 'string')
    .map(part => ({ type: part.type, text: part.text }))

export const createWorkflowClient = (session: Session, directory?: string): WorkflowSdkClient => ({
  session: {
    fork: async (input) => {
      const service = await getClient(undefined, directory)
      const info = await service.session.fork({ sessionID: input.sessionID })
      return { data: { id: info.id } }
    },
    create: async ({ body }) => {
      const info = await run(session.create({ title: body.title, parentID: body.parentID as never }))
      const id = (info as { id?: string } | undefined)?.id ?? ''
      return { data: { id } }
    },
    prompt: async ({ path, body }) => {
      const text = body.parts.map(part => part.text).join('')
      await run(session.switchAgent({ sessionID: path.id as never, agent: body.agent as never }))
      if (body.model !== undefined) {
        await run(session.switchModel({
          sessionID: path.id as never,
          model: { id: body.model.modelID, providerID: body.model.providerID } as never,
        }))
      }
      await run(session.prompt({ sessionID: path.id as never, text }))
      await run(session.wait({ sessionID: path.id as never }))
      const messages = await run(session.context({ sessionID: path.id as never }))
      const assistant = lastAssistant(messages)
      const info = assistant?.error === undefined ? undefined : { error: assistant.error }
      return { data: { info, parts: assistantTextParts(messages) } }
    },
    messages: async ({ path }) => {
      const messages = await run(session.context({ sessionID: path.id as never }))
      const data = (messages as ReadonlyArray<V2Message>).map(message => ({
        info: {
          role: message.type,
          providerID: message.model?.providerID,
          modelID: message.model?.id,
        },
      }))
      return { data: data as never }
    },
    update: async ({ path, body }) => {
      await run(session.update({ sessionID: path.id as never, title: body.title }))
    },
    abort: async ({ path }) => {
      await run(session.interrupt({ sessionID: path.id as never }))
    },
  },
})
