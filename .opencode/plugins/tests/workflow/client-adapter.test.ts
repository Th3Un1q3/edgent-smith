import { describe, expect, it } from 'vitest'

import { Effect } from 'effect'

import '@tests/workflow/plugin-mocks'

import { createWorkflowClient } from '@plugins/workflow/client-adapter'

describe('workflow client adapter (v2 -> v1 shape)', () => {
  it('maps prompt to admit + wait + context and returns the assistant text parts', async () => {
    const calls: string[] = []
    const session = {
      switchAgent: () => {
        calls.push('switch')
        return Effect.succeed(undefined)
      },
      prompt: (input: { text: string }) => {
        calls.push('prompt:' + input.text)
        return Effect.succeed({})
      },
      wait: () => {
        calls.push('wait')
        return Effect.succeed(undefined)
      },
      context: () => {
        calls.push('context')
        return Effect.succeed([{ type: 'assistant', content: [{ type: 'text', text: 'ANSWER' }] }])
      },
    }
    const client = createWorkflowClient(session as never)
    const response = await client.session.prompt({ path: { id: 'ses_1' }, body: { agent: 'build', parts: [{ type: 'text', text: 'Q' }] } })

    expect(calls).toEqual(['switch', 'prompt:Q', 'wait', 'context'])
    expect(response.data?.parts).toEqual([{ type: 'text', text: 'ANSWER' }])
  })

  it('sets the child agent before prompting', async () => {
    const calls: string[] = []
    const session = {
      switchAgent: (input: { agent: string }) => {
        calls.push('switch:' + input.agent)
        return Effect.succeed(undefined)
      },
      prompt: () => Effect.succeed({}),
      wait: () => Effect.succeed(undefined),
      context: () => Effect.succeed([]),
    }
    const client = createWorkflowClient(session as never)

    await client.session.prompt({ path: { id: 'ses_1' }, body: { agent: 'general', parts: [{ type: 'text', text: 'Q' }] } })
    expect(calls).toEqual(['switch:general'])
  })

  it('applies the inherited parent model through switchModel before prompting', async () => {
    const calls: string[] = []
    const session = {
      switchAgent: () => Effect.succeed(undefined),
      switchModel: (input: { model: { id: string, providerID: string } }) => {
        calls.push('switchModel:' + input.model.providerID + '/' + input.model.id)
        return Effect.succeed(undefined)
      },
      prompt: () => Effect.succeed({}),
      wait: () => Effect.succeed(undefined),
      context: () => Effect.succeed([]),
    }
    const client = createWorkflowClient(session as never)

    await client.session.prompt({
      path: { id: 'ses_1' },
      body: { agent: 'build', model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' }, parts: [{ type: 'text', text: 'Q' }] },
    })
    expect(calls).toEqual(['switchModel:opencode-go/deepseek-v4.1-flash'])
  })

  it('maps v2 session messages to the v1 info shape for model inheritance', async () => {
    const session = {
      context: () => Effect.succeed([
        { type: 'user', text: 'hi' },
        { type: 'assistant', model: { id: 'deepseek-v4.1-flash', providerID: 'opencode-go' }, content: [] },
      ]),
    }
    const client = createWorkflowClient(session as never)
    const messages = client.session.messages
    if (messages === undefined) throw new Error('adapter must expose session.messages')
    const response = await messages({ path: { id: 'ses_1' } })

    expect(response.data).toEqual([
      { info: { role: 'user', providerID: undefined, modelID: undefined } },
      { info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } },
    ])
  })
})
