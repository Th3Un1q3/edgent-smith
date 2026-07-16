import { describe, it, expect } from "vitest"
import type { Todo } from "@opencode-ai/sdk"
import { opencodeClientFactory } from "@tests/__utils/factories/client-factory"

describe("opencodeClientFactory", () => {
    describe("default behavior", () => {
        it("defaults to agentName 'build' when no params provided", async () => {
            const client = opencodeClientFactory()
            const result = await client.app.agents()
            expect(result.data).toEqual([{ name: "build" }])
        })

        it("accepts an explicit agentName", async () => {
            const client = opencodeClientFactory({ agentName: "test-agent" })
            const result = await client.app.agents()
            expect(result.data).toEqual([{ name: "test-agent" }])
        })

        it("respects a custom todoList", async () => {
            const todos = [{ id: "1", title: "hello" }] as unknown as Todo[]
            const client = opencodeClientFactory({ agentName: "build", todoList: todos })
            const result = await client.session.todo()
            expect(result.data).toBe(todos)
        })
    })

    describe("agentList parameter", () => {
        it("uses agentList when provided (takes precedence over agentName)", async () => {
            const agents = [
                { name: "build", steps: 50 },
                { name: "test-agent" },
            ]
            const client = opencodeClientFactory({
                agentName: "ignored",
                agentList: agents,
            })
            const result = await client.app.agents()
            expect(result.data).toEqual(agents)
        })

        it("defaults to { name: 'build' } when neither agentName nor agentList is provided", async () => {
            const client = opencodeClientFactory({})
            const result = await client.app.agents()
            expect(result.data).toEqual([{ name: "build" }])
        })
    })
})
