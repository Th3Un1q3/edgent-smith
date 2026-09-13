import { vi } from 'vitest'
import type { Todo } from '@opencode-ai/sdk'

type OpencodeClientFactoryParameters = {
  agentName?: string
  todoList?: Todo[]
  agentList?: Array<{ name: string, steps?: number }>
}

export type OpencodeClientFactoryReturn = {
  session: {
    get: ReturnType<typeof vi.fn>
    todo: ReturnType<typeof vi.fn>
    prompt: ReturnType<typeof vi.fn>
  }
  app: {
    log: ReturnType<typeof vi.fn>
    agents: ReturnType<typeof vi.fn>
  }
}

/**
 * Factory function to create a mock OpencodeClient for testing purposes.
 * @param agentName - The name of the agent to be used in the mock client. Defaults to "build".
 * @param todoList - An array of todo items to be returned by the mock client's session.todo method. Defaults to an empty array.
 * @returns A mock OpencodeClient with predefined methods and behaviors.
 */
const opencodeClientFactory = (parameters?: OpencodeClientFactoryParameters): OpencodeClientFactoryReturn => {
  const { agentName = 'build', todoList = [] as Todo[], agentList }: OpencodeClientFactoryParameters = parameters ?? {}
  return {
    session: {
      get: vi.fn().mockResolvedValue({ data: { agent: agentName } }),
      todo: vi.fn().mockResolvedValue({ data: todoList }),
      prompt: vi.fn().mockResolvedValue({}),
    },
    app: {
      /**
             * methods not implemented */
      log: vi.fn(),
      agents: vi.fn().mockResolvedValue({ data: agentList ?? [{ name: agentName }] }),
    },
  }
}

export { opencodeClientFactory, OpencodeClientFactoryParameters }
