import { beforeEach, describe, expect, it, vi } from "vitest"

// Step 1: declare mocks at file top (vitest hoists these automatically)
vi.mock("../helpers/instruction-indexer")
vi.mock("../helpers/session-helpers")
vi.mock("../helpers/logger")
vi.mock("../helpers/kv-store", () => {
    const mockReadState = vi.fn().mockReturnValue(undefined)
    const mockUpdateState = vi.fn()

    class MockSessionStorage {
        readState = mockReadState
        updateState = mockUpdateState
    }
    return { SessionStorage: MockSessionStorage }
})

// Step 2: import stubs — must come AFTER vi.mock() calls
import { instructionsLoaderPlugin } from "../instructions-loader"
import * as instructionIndexer from "../helpers/instruction-indexer"
import * as sessionHelpers from "../helpers/session-helpers"

type ClientMock = {
    session: { get: (args: { path: { id: string } }) => Promise<{ data?: Record<string, unknown> }> }
}

const createClient = (): ClientMock => ({
    session: { get: vi.fn().mockResolvedValue({ data: {} }) },
})

// Helper to build mock instructions with the correct shape.
const makeInstructions = (path: string, description: string) => [
    { path, description, applyTo: "**/*.{ts}" },
] as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]> extends () => Promise<infer T> ? T : never

// Input types for the hook — mirrors Plugin "tool.execute.before" signature.
type HookInput = { tool: string; sessionID?: string; callID?: string }
type HookOutput = { args?: Record<string, unknown> } | {}

describe("instructionsLoaderPlugin", () => {
    let client: ClientMock
    const directory = "/workspace"

    beforeEach(() => {
        client = createClient()
        // // Reset the mock call count between tests to track how many times createIndex is invoked.
        // vi.mocked(instructionIndexer.createIndex).mockClear()
        // vi.mocked(sessionHelpers.sendMessage).mockClear()
    })

    describe("tool.execute.before hook", () => {
        it.each([
            { name: "write", tool: "write" },
            { name: "edit", tool: "edit" },
            { name: "read", tool: "read" },
        ])("sends instructions for '$name' targeted tools when file matches", async ({ tool }) => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test instruction"),
            })

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool, sessionID: "sess-1", callID: "call-1" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("does not send instructions for non-targeted tools", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
            })

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "ls", sessionID: "sess-1", callID: "call-ls" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("skips when no sessionID is provided", async () => {
            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write" } as any, // no sessionID — testing the guard clause
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("skips when output.args.filePath is missing", async () => {
            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1" } as any, // input type requires callID but we test edge cases
                {} as any, // no args — testing the guard clause
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("returns zero instructions when no file paths match the index", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [],
            })

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1", callID: "call-unknown" },
                { args: { filePath: "/unknown/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })
    })

    describe("agent-specific index caching", () => {
        it("creates a new index for the default 'build' agent when session has no agent field", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
            })

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-no-agent", callID: "call-build-default" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
            const [opts] = vi.mocked(instructionIndexer.createIndex).mock.calls[0] as Parameters<typeof instructionIndexer.createIndex>
            expect(opts.agent).toBe("build")
        })

        it("reuses the cached index for repeated calls with the same default agent", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
            })

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            // First call — creates index for default agent
            await hookFn(
                { tool: "write", sessionID: "sess-a", callID: "call-first" },
                { args: { filePath: "/some/file.ts" } },
            )
            vi.mocked(sessionHelpers.sendMessage).mockClear()

            // Second call with a different session but same default agent — should reuse cached index
            await hookFn(
                { tool: "write", sessionID: "sess-b", callID: "call-second" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
        })

        it("creates a separate index when the session agent differs from the default", async () => {
            // Client that returns agent: "copilot" for sess-copilot, undefined for others
            const copilotClient = createClient()
            const getSpy = vi.spyOn(copilotClient.session, "get")
            getSpy.mockImplementation(async (args) => {
                if (args.path.id === "sess-copilot") {
                    return { data: { agent: "copilot" } };
                }
                return { data: {} };
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
            })

            const plugin = await instructionsLoaderPlugin({ client: copilotClient, directory } as any)
            const hookFn = plugin["tool.execute.before"]!

            // First call — default agent (build)
            await hookFn(
                { tool: "write", sessionID: "sess-no-agent", callID: "call-build" },
                { args: { filePath: "/some/file.ts" } },
            )
            vi.mocked(sessionHelpers.sendMessage).mockClear()

            // Second call — different agent (copilot) should trigger new index creation
            await hookFn(
                { tool: "write", sessionID: "sess-copilot", callID: "call-copilot" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(2)
        })

        it("never creates more indexes than unique agents across multiple sessions", async () => {
            const indexedAgents = new Set<string>()
            vi.mocked(instructionIndexer.createIndex).mockImplementation(async (opts) => {
                indexedAgents.add(opts.agent)
                return { forFiles: async () => [] }
            })

            // Simulate 5 different sessions, alternating between agents
            const testSessions = [
                { agent: "build" },
                { agent: "copilot" },
                { agent: "designer" },
                { agent: "copilot" as string },   // duplicate — should reuse cache
                { agent: "build" as string },     // duplicate — should reuse cache
            ]

            for (const session of testSessions) {
                const client = createClient()
                vi.spyOn(client.session, "get").mockResolvedValue({ data: session })

                const plugin = await instructionsLoaderPlugin({ client, directory } as any)
                const hookFn = plugin["tool.execute.before"]!
                await hookFn(
                    { tool: "write", sessionID: `sess-${session.agent}`, callID: `call-${session.agent}` },
                    { args: { filePath: "/some/file.ts" } },
                )
            }

            // Only 3 unique agents should have been indexed (build, copilot, designer)
            expect(indexedAgents.size).toBe(3)
        })
    })
})
