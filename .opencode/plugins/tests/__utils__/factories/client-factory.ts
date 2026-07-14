import { vi } from "vitest"
import type { OpencodeClient, Todo } from "@opencode-ai/sdk"

type OpencodeClientFactoryParameters = {
    agentName?: string
    todoList?: Todo[]
}

/**
 * Factory function to create a mock OpencodeClient for testing purposes.
 * @param agentName - The name of the agent to be used in the mock client. Defaults to "build".
 * @param todoList - An array of todo items to be returned by the mock client's session.todo method. Defaults to an empty array.
 * @returns A mock OpencodeClient with predefined methods and behaviors.
 */
const opencodeClientFactory = ({
    agentName = "build",
    todoList = [] as Todo[],
} = {}) => {
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
            agents: vi.fn().mockResolvedValue({ data: [{ name: agentName }] }),
        }
    }
}

export { opencodeClientFactory, OpencodeClientFactoryParameters }