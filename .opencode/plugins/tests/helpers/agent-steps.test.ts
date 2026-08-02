import { describe, it, expect, vi } from 'vitest'

import { fetchAgentList, getAgentSteps, getSessionAgent } from '@plugins/helpers/agent-steps'

const createMockClient = (agentsResult: unknown) => ({
  app: { agents: vi.fn().mockResolvedValue(agentsResult) },
})

const createSessionMockClient = (sessionResult: unknown) => ({
  session: { get: vi.fn().mockResolvedValue(sessionResult) },
})

// ── getAgentSteps ────────────────────────────────────────────────

describe('getAgentSteps', () => {
  it('returns steps count when agent exists with numeric steps', async () => {
    const client = createMockClient({ data: [{ name: 'rug-swe', steps: 25 }] })

    const result = await getAgentSteps(client, 'rug-swe')

    expect(result).toBe(25)
    expect(client.app.agents).toHaveBeenCalledOnce()
  })

  it.each([
    { scenario: 'agent not found in list', data: [{ name: 'build', steps: 10 }] },
    { scenario: 'agent has no steps property', data: [{ name: 'rug-swe' }] },
    { scenario: 'steps is a string', data: [{ name: 'rug-swe', steps: 'hello' }] },
    { scenario: 'steps is null', data: [{ name: 'rug-swe', steps: null }] },
  ])('returns undefined when $scenario', async ({ data }) => {
    const client = createMockClient({ data })

    const result = await getAgentSteps(client, 'rug-swe')

    expect(result).toBeUndefined()
  })

  it('returns undefined when API throws', async () => {
    const client = {
      app: { agents: vi.fn().mockRejectedValue(new Error('API error')) },
    }

    const result = await getAgentSteps(client, 'rug-swe')

    expect(result).toBeUndefined()
  })
})

// ── fetchAgentList ───────────────────────────────────────────────

describe('fetchAgentList', () => {
  it('returns data array on valid response', async () => {
    const client = createMockClient({ data: [{ name: 'rug-swe', steps: 25 }] })

    const result = await fetchAgentList(client)

    expect(result).toEqual([{ name: 'rug-swe', steps: 25 }])
  })

  it('returns [] when API throws', async () => {
    const client = {
      app: { agents: vi.fn().mockRejectedValue(new Error('API error')) },
    }

    const result = await fetchAgentList(client)

    expect(result).toEqual([])
  })

  it('returns [] when data is missing from response', async () => {
    const client = createMockClient({})

    const result = await fetchAgentList(client)

    expect(result).toEqual([])
  })
})

// ── getSessionAgent ──────────────────────────────────────────────

describe('getSessionAgent', () => {
  it('returns agent name when valid string is present', async () => {
    const client = createSessionMockClient({ data: { agent: 'rug-swe' } })

    const result = await getSessionAgent(client, 'session-1')

    expect(result).toBe('rug-swe')
    expect(client.session.get).toHaveBeenCalledWith({ path: { id: 'session-1' } })
  })

  it.each([
    { scenario: 'agent is empty string', data: { data: { agent: '' } } },
    { scenario: 'agent field missing', data: { data: {} } },
    { scenario: 'session.get returns null', data: null },
    { scenario: 'agent is not a string', data: { data: { agent: 42 } } },
  ])('returns \'build\' when $scenario', async ({ data }) => {
    const client = createSessionMockClient(data)

    const result = await getSessionAgent(client, 'session-1')

    expect(result).toBe('build')
  })
})
