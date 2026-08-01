import { describe, it, expect, vi } from "vitest"

import { fetchAgentList, getAgentSteps, getSessionAgent } from "@plugins/helpers/agent-steps"

// ── Helpers ───────────────────────────────────────────────────────

function createMockClient(agentsResult: unknown) {
    return {
        app: {
            agents: vi.fn().mockResolvedValue(agentsResult),
        },
    }
}

function createSessionMockClient(sessionResult: unknown) {
    return {
        session: {
            get: vi.fn().mockResolvedValue(sessionResult),
        },
    }
}

// ── Tests ─────────────────────────────────────────────────────────

describe("getAgentSteps", () => {
    it("returns steps when agent exists and has steps", async () => {
        const client = createMockClient({ data: [{ name: "rug-swe", steps: 25 }] })

        const result = await getAgentSteps(client, "rug-swe")

        expect(result).toBe(25)
    })

    it("returns undefined when agent not found in list", async () => {
        const client = createMockClient({ data: [{ name: "build", steps: 10 }] })

        const result = await getAgentSteps(client, "rug-swe")

        expect(result).toBeUndefined()
    })

    it("returns undefined when agent found but has no steps property", async () => {
        const client = createMockClient({ data: [{ name: "build" }] })

        const result = await getAgentSteps(client, "build")

        expect(result).toBeUndefined()
    })

    it("returns undefined when API throws error", async () => {
        const client = {
            app: {
                agents: vi.fn().mockRejectedValue(new Error("API error")),
            },
        }

        const result = await getAgentSteps(client, "rug-swe")

        expect(result).toBeUndefined()
    })

    it("returns undefined when data is missing from response", async () => {
        const client = createMockClient({})

        const result = await getAgentSteps(client, "rug-swe")

        expect(result).toBeUndefined()
    })

    it("returns undefined when agent has string steps instead of number", async () => {
        const client = createMockClient({ data: [{ name: "rug-swe", steps: "hello" }] })

        const result = await getAgentSteps(client, "rug-swe")

        expect(result).toBeUndefined()
    })

    it("returns undefined when agent has null steps", async () => {
        const client = createMockClient({ data: [{ name: "rug-swe", steps: null }] })

        const result = await getAgentSteps(client, "rug-swe")

        expect(result).toBeUndefined()
    })
})

describe("fetchAgentList", () => {
    it("returns [] when API throws error", async () => {
        const client = {
            app: { agents: vi.fn().mockRejectedValue(new Error("API error")) },
        }

        const result = await fetchAgentList(client)

        expect(result).toEqual([])
    })

    it("returns [] when data is missing from response", async () => {
        const client = createMockClient({})

        const result = await fetchAgentList(client)

        expect(result).toEqual([])
    })

    it("returns data array when response is valid", async () => {
        const client = createMockClient({ data: [{ name: "rug-swe", steps: 25 }] })

        const result = await fetchAgentList(client)

        expect(result).toEqual([{ name: "rug-swe", steps: 25 }])
    })
})

describe("getSessionAgent", () => {
    it("returns agent name when valid string is present", async () => {
        const client = createSessionMockClient({ data: { agent: "rug-swe" } })

        const result = await getSessionAgent(client, "session-1")

        expect(result).toBe("rug-swe")
    })

    it("returns 'build' when agent is empty string", async () => {
        const client = createSessionMockClient({ data: { agent: "" } })

        const result = await getSessionAgent(client, "session-1")

        expect(result).toBe("build")
    })

    it("returns 'build' when agent field is missing from data", async () => {
        const client = createSessionMockClient({ data: {} })

        const result = await getSessionAgent(client, "session-1")

        expect(result).toBe("build")
    })

    it("returns 'build' when session.get returns null", async () => {
        const client = createSessionMockClient(null)

        const result = await getSessionAgent(client, "session-1")

        expect(result).toBe("build")
    })

    it("returns 'build' when agent is not a string", async () => {
        const client = createSessionMockClient({ data: { agent: 42 } })

        const result = await getSessionAgent(client, "session-1")

        expect(result).toBe("build")
    })
})
