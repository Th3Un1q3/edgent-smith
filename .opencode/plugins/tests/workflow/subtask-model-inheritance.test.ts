import { describe, expect, it, vi } from 'vitest'

import { createSubtask, resolveParentModel } from '@plugins/workflow/subtask'
import type { WorkflowSdkClient } from '@plugins/workflow/contracts'
import { createClient, makeContext } from '@tests/workflow/subtask-fixtures'

// ── createSubtask: parent model inheritance ──────────────────────

describe('createSubtask parent model inheritance', () => {
  const modelCases: Array<[string, Array<{ info: Record<string, unknown> }>, { providerID: string, modelID: string }]> = [
    ['the last assistant message', [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }], { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' }],
    ['the user-message info.model shape', [{ info: { role: 'user', model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } } }], { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' }],
    ['entries without a model, scanning from the end', [{ info: { providerID: 'first', modelID: 'old' } }, { info: { role: 'assistant' } }], { providerID: 'first', modelID: 'old' }],
    ['the last message over earlier ones', [{ info: { providerID: 'first', modelID: 'old' } }, { info: { providerID: 'last', modelID: 'new' } }], { providerID: 'last', modelID: 'new' }],
  ]

  it.each(modelCases)('inherits the model from %s', async (_label, entries, expected) => {
    const messages = vi.fn(async () => ({ data: entries }))
    const client = createClient({ messages })

    await createSubtask(makeContext(client))('do work')

    expect(client.session.prompt.mock.calls[0][0].body.model).toEqual(expected)
  })

  it('resolves the parent model at most once across subtasks', async () => {
    const messages = vi.fn(async () => ({
      data: [{ info: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
    }))
    const context = makeContext(createClient({ messages }))
    const subtask = createSubtask(context)

    await Promise.all([subtask('a'), subtask('b'), subtask('c')])

    expect(messages).toHaveBeenCalledTimes(1)
    expect(messages).toHaveBeenCalledWith({ path: { id: 'ses_parent' } })
  })

  it('proceeds without a model and warns when messages is unavailable', async () => {
    const client = createClient()
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('proceeds without a model and warns when messages rejects', async () => {
    const messages = vi.fn(async () => {
      throw new Error('no history')
    })
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('proceeds without a model when no message carries one', async () => {
    const messages = vi.fn(async () => ({ data: [{ info: { role: 'assistant' } }] }))
    const client = createClient({ messages })
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(client.session.prompt.mock.calls[0][0].body.model).toBeUndefined()
    expect(context.logs.some(line => line.includes('model'))).toBe(true)
  })

  it('resolveParentModel returns undefined when messages is missing', async () => {
    await expect(resolveParentModel(createClient(), 'ses_parent')).resolves.toBeUndefined()
  })

  // Regression: the generated SDK methods rely on `this._client`, so a detached
  // `const messages = client.session.messages` throws on every call and silently
  // disables model inheritance. This mock is receiver-sensitive and only resolves
  // when `this` is still the session object.
  it('preserves the session receiver while resolving the parent model', async () => {
    const prompt = vi.fn<(input: { body: { model?: unknown } }) => Promise<{ data: unknown }>>(
      async () => ({
        data: { info: {}, parts: [{ type: 'text', text: 'OUT' }] },
      }),
    )
    const session = {
      create: vi.fn(async () => ({ data: { id: 'ses_child' } })),
      prompt,
      abort: vi.fn(async () => true),
      async messages(this: { __client?: unknown } | undefined) {
        if (this === undefined || this.__client === undefined) {
          throw new TypeError('undefined is not an object (evaluating \'this._client\')')
        }
        return {
          data: [{ info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } }],
        }
      },
    }
    let receiverAccesses = 0
    Object.defineProperty(session, '__client', {
      get() {
        receiverAccesses += 1
        return {}
      },
    })
    const client = { session } as unknown as WorkflowSdkClient
    const context = makeContext(client)

    const result = await createSubtask(context)('do work')

    expect(result.status).toBe('ok')
    expect(prompt.mock.calls[0][0].body.model).toEqual({
      providerID: 'opencode-go',
      modelID: 'deepseek-v4.1-flash',
    })
    expect(receiverAccesses).toBeGreaterThan(0)
    expect(context.logs.some(line => line.includes('failed to resolve parent model'))).toBe(false)
  })
})
