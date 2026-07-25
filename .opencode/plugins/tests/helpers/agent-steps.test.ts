import { describe, it, expect, vi } from "vitest"

import { getAgentSteps } from "@plugins/helpers/agent-steps"

// ── Helpers ───────────────────────────────────────────────────────

function createMockClient(agentsResult: unknown) {
    return {
        app: {
            agents: vi.fn().mockResolvedValue(agentsResult),
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
})
