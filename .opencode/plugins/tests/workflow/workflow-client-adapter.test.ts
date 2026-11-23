import type { OpenCodeClient } from '@opencode/client'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceClient = vi.hoisted(() => ({ getClient: vi.fn() }))

vi.mock('@plugins/helpers/runtime/service-client', () => ({ getClient: serviceClient.getClient }))

import { createWorkflowClient } from '@plugins/workflow/client-adapter'
import { createSubtask } from '@plugins/workflow/subtask'
import type { WorkflowContext } from '@plugins/workflow/contracts'

const serviceWith = (session: Record<string, unknown>): OpenCodeClient =>
  ({ session } as unknown as OpenCodeClient)

const passthrough = Effect.succeed(undefined)

const sessionStub = (): Record<string, any> => ({
  create: vi.fn(() => Effect.succeed({ id: 'ses_created' })),
  switchAgent: vi.fn(() => passthrough),
  switchModel: vi.fn(() => passthrough),
  prompt: vi.fn(() => passthrough),
  wait: vi.fn(() => passthrough),
  interrupt: vi.fn(() => passthrough),
  context: vi.fn(() => Effect.succeed([
    {
      type: 'assistant',
      content: [{ type: 'text', text: 'OUT' }],
      model: { id: 'deepseek-v4.1-flash', providerID: 'opencode-go' },
    },
  ])),
})

const asSession = (stub: Record<string, unknown>): Parameters<typeof createWorkflowClient>[0] =>
  stub as unknown as Parameters<typeof createWorkflowClient>[0]

const makeContext = (client: any): WorkflowContext => ({
  client,
  parentSessionID: 'ses_parent',
  signal: new AbortController().signal,
  defaultAgent: 'rug-swe',
  maxSubtasks: 32,
  budget: { used: 0 },
  steps: [],
  logs: [],
  active: new Set(),
})

beforeEach(() => {
  serviceClient.getClient.mockReset()
})

describe('createWorkflowClient fork', () => {
  it('forks the source session through the service client without a boundary', async () => {
    const fork = vi.fn(async () => ({ id: 'ses_fork' }))
    serviceClient.getClient.mockResolvedValue(serviceWith({ fork }))
    const client = createWorkflowClient(asSession(sessionStub()), '/workspace/project')
    const adapterFork = client.session.fork
    if (adapterFork === undefined) throw new Error('adapter fork is missing')

    const forked = await adapterFork({ sessionID: 'ses_source' })

    expect(serviceClient.getClient).toHaveBeenCalledWith(undefined, '/workspace/project')
    expect(fork).toHaveBeenCalledWith({ sessionID: 'ses_source' })
    expect(forked).toEqual({ data: { id: 'ses_fork' } })
  })

  it('does not resolve the service client until a fork is requested', () => {
    const client = createWorkflowClient(asSession(sessionStub()), '/workspace/project')

    expect(client.session.fork).toBeTypeOf('function')
    expect(serviceClient.getClient).not.toHaveBeenCalled()
  })

  it('runs the child on the forked session id', async () => {
    const fork = vi.fn(async () => ({ id: 'ses_fork' }))
    serviceClient.getClient.mockResolvedValue(serviceWith({ fork }))
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const result = await createSubtask(makeContext(client))({
      prompt: 'audit A',
      description: 'audit A',
      fork_from: 'ses_source',
    })

    expect(fork).toHaveBeenCalledWith({ sessionID: 'ses_source' })
    expect(session.prompt).toHaveBeenCalledWith({ sessionID: 'ses_fork', text: 'audit A' })
    expect(result.status).toBe('ok')
    expect(result.task_id).toBe('ses_fork')
    expect(result.forked_from).toBe('ses_source')
  })
})

const assistantMessage = (text: string): Record<string, unknown> => ({
  type: 'assistant',
  content: [{ type: 'text', text }],
})

describe('createWorkflowClient prompt context selection', () => {
  it('uses the last assistant message when a later user message and null entries follow', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      assistantMessage('A'),
      { type: 'user', content: [{ type: 'text', text: 'U' }] },
      assistantMessage('B'),
      null,
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.parts).toEqual([{ type: 'text', text: 'B' }])
    expect(session.wait).toHaveBeenCalledWith({ sessionID: 'ses_child' })
    expect(session.context).toHaveBeenCalledWith({ sessionID: 'ses_child' })
  })

  it('does not let a trailing user message replace the assistant result', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      assistantMessage('A'),
      { type: 'user', content: [{ type: 'text', text: 'U' }] },
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.parts).toEqual([{ type: 'text', text: 'A' }])
  })

  it('returns no parts when no assistant message is present', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      { type: 'user', content: [{ type: 'text', text: 'U' }] },
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.parts).toEqual([])
  })
})

describe('createWorkflowClient assistant text parts', () => {
  it('drops reasoning parts and text parts without text', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      {
        type: 'assistant',
        content: [
          { type: 'reasoning', text: 'thinking' },
          { type: 'text', text: 'OUT' },
          { type: 'text' },
        ],
      },
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.parts).toEqual([{ type: 'text', text: 'OUT' }])
  })

  it('returns every text part in order', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      {
        type: 'assistant',
        content: [
          { type: 'text', text: 'one' },
          { type: 'text', text: 'two' },
        ],
      },
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.parts).toEqual([
      { type: 'text', text: 'one' },
      { type: 'text', text: 'two' },
    ])
  })
})

describe('createWorkflowClient prompt request', () => {
  it('concatenates multiple text parts into one prompt', async () => {
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'Q' }, { type: 'text', text: 'R' }] },
    })

    expect(session.switchAgent).toHaveBeenCalledWith({ sessionID: 'ses_child', agent: 'rug-swe' })
    expect(session.prompt).toHaveBeenCalledWith({ sessionID: 'ses_child', text: 'QR' })
    expect(response.data?.parts).toEqual([{ type: 'text', text: 'OUT' }])
  })

  it('switches the model only when one is supplied', async () => {
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(session.switchModel).not.toHaveBeenCalled()
  })

  it('maps a supplied model onto the V2 model ref', async () => {
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    await client.session.prompt({
      path: { id: 'ses_child' },
      body: {
        agent: 'rug-swe',
        parts: [{ type: 'text', text: 'go' }],
        model: { providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' },
      },
    })

    expect(session.switchModel).toHaveBeenCalledWith({
      sessionID: 'ses_child',
      model: { id: 'deepseek-v4.1-flash', providerID: 'opencode-go' },
    })
  })

  it('reports an assistant error in the response info', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      { type: 'assistant', content: [], error: { message: 'boom' } },
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.info).toEqual({ error: { message: 'boom' } })
  })

  it('leaves the response info undefined when the assistant has no error', async () => {
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const response = await client.session.prompt({
      path: { id: 'ses_child' },
      body: { agent: 'rug-swe', parts: [{ type: 'text', text: 'go' }] },
    })

    expect(response.data?.info).toBeUndefined()
  })
})

describe('createWorkflowClient messages', () => {
  it('maps a model-less message onto the V1 info shape', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([{ type: 'user' }]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')
    const messages = client.session.messages
    if (messages === undefined) throw new Error('adapter messages is missing')

    const response = await messages({ path: { id: 'ses_child' } })

    expect(response.data).toStrictEqual([
      { info: { role: 'user', providerID: undefined, modelID: undefined } },
    ])
  })

  it('maps each message role and model onto the V1 info shape', async () => {
    const session = sessionStub()
    session.context = vi.fn(() => Effect.succeed([
      { type: 'user' },
      { type: 'assistant', model: { id: 'deepseek-v4.1-flash', providerID: 'opencode-go' } },
    ]))
    const client = createWorkflowClient(asSession(session), '/workspace/project')
    const messages = client.session.messages
    if (messages === undefined) throw new Error('adapter messages is missing')

    const response = await messages({ path: { id: 'ses_child' } })

    expect(response.data).toStrictEqual([
      { info: { role: 'user', providerID: undefined, modelID: undefined } },
      { info: { role: 'assistant', providerID: 'opencode-go', modelID: 'deepseek-v4.1-flash' } },
    ])
    expect(session.context).toHaveBeenCalledWith({ sessionID: 'ses_child' })
  })
})

describe('createWorkflowClient create', () => {
  it('creates the child session with the requested title and parent', async () => {
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const created = await client.session.create({ body: { title: 'Audit', parentID: 'ses_parent' } })

    expect(session.create).toHaveBeenCalledWith({ title: 'Audit', parentID: 'ses_parent' })
    expect(created).toEqual({ data: { id: 'ses_created' } })
  })

  it('maps a missing session id to an empty string', async () => {
    const session = sessionStub()
    session.create = vi.fn(() => Effect.succeed(undefined))
    const client = createWorkflowClient(asSession(session), '/workspace/project')

    const created = await client.session.create({ body: { title: 'Audit' } })

    expect(created).toEqual({ data: { id: '' } })
  })
})

describe('createWorkflowClient abort', () => {
  it('interrupts the session without prompting it', async () => {
    const session = sessionStub()
    const client = createWorkflowClient(asSession(session), '/workspace/project')
    const abort = client.session.abort
    if (abort === undefined) throw new Error('adapter abort is missing')

    await abort({ path: { id: 'ses_child' } })

    expect(session.interrupt).toHaveBeenCalledWith({ sessionID: 'ses_child' })
    expect(session.prompt).not.toHaveBeenCalled()
  })

  it('honours the abort request by completing the interruption before resolving', async () => {
    const session = sessionStub()
    let isInterrupted = false
    session.interrupt = vi.fn(() => Effect.sync(() => {
      isInterrupted = true
    }))
    const client = createWorkflowClient(asSession(session), '/workspace/project')
    const abort = client.session.abort
    if (abort === undefined) throw new Error('adapter abort is missing')

    await expect(abort({ path: { id: 'ses_child' } })).resolves.toBeUndefined()
    expect(isInterrupted).toBe(true)
  })
})
