import type { OpenCodeClient } from '@opencode/client'
import { Effect } from 'effect'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const serviceClient = vi.hoisted(() => ({ getClient: vi.fn() }))

vi.mock('@plugins/helpers/service-client', () => ({ getClient: serviceClient.getClient }))

import { createWorkflowClient } from '@plugins/helpers/workflow-client-adapter'
import { createSubtask } from '@plugins/helpers/workflow-subtask'
import type { WorkflowContext } from '@plugins/helpers/workflow-types'

const serviceWith = (session: Record<string, unknown>): OpenCodeClient =>
  ({ session } as unknown as OpenCodeClient)

const passthrough = Effect.succeed(undefined)

const sessionStub = (): Record<string, any> => ({
  create: vi.fn(() => Effect.succeed({ id: 'ses_created' })),
  update: vi.fn(() => passthrough),
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
  maxConcurrent: 4,
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
