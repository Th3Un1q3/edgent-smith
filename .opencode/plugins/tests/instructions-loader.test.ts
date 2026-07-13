import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock factories — synchronous imports avoid circular dependency issues.
import { defaultCreateClient, makeKvStoreMockFactory } from "./helpers/mock-utils"

// Step 1: declare mocks at file top (vitest hoists these automatically)
vi.mock("../helpers/instruction-indexer")
vi.mock("../helpers/session-helpers")
vi.mock("../helpers/logger")
vi.mock(
  "../helpers/kv-store",
  () => makeKvStoreMockFactory(),
)

// Step 2: import stubs — must come AFTER vi.mock() calls
import { instructionsLoaderPlugin, type StateWithIdempotencyTokens } from "../instructions-loader"
import * as instructionIndexer from "../helpers/instruction-indexer"
import * as sessionHelpers from "../helpers/session-helpers"
import { _mockReadState as mockReadState, _mockUpdateState as mockUpdateState } from "../helpers/kv-store"

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
        client = defaultCreateClient()
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
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

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
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

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
                loadBody: async (path: string) => `Content of ${path}`,
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
                loadBody: async (path: string) => `Content of ${path}`,
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
                loadBody: async (path: string) => `Content of ${path}`,
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
            const copilotClient = defaultCreateClient()
            const getSpy = vi.spyOn(copilotClient.session, "get")
            getSpy.mockImplementation(async (args) => {
                if (args.path.id === "sess-copilot") {
                    return { data: { agent: "copilot" } };
                }
                return { data: {} };
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
                loadBody: async (path: string) => `Content of ${path}`,
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
                return { forFiles: async () => [], loadBody: async (_path: string) => "" } as any
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
                const client = defaultCreateClient()
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

    describe("idempotency edge cases", () => {
        it("skips instructions already sent in a previous call", async () => {
            // readState returns stored tokens — the instruction's token matches, so it gets filtered out
            vi.mocked(mockReadState).mockImplementation((sessionId: string, reader: (state: StateWithIdempotencyTokens) => Record<string, string>) => {
                const state = { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } }
                return reader(state as StateWithIdempotencyTokens)
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test instruction"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1", callID: "call-1" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("sends only new instructions when some were previously sent", async () => {
            // readState returns stored tokens — /old/file.ts is filtered, /new/file.ts is sent
            vi.mocked(mockReadState).mockImplementation((sessionId: string, reader: (state: StateWithIdempotencyTokens) => Record<string, string>) => {
                const state = { idempotencyTokens: { "instruction_load:/old/file.ts": "2026-01-01T00:00:00Z" } }
                return reader(state as StateWithIdempotencyTokens)
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/old/file.ts", description: "Old instruction", applyTo: "**/*.{ts}" },
                    { path: "/new/file.ts", description: "New instruction", applyTo: "**/*.{ts}" },
                ] as unknown as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]>,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1", callID: "call-mixed" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("=== INSTRUCTION: New instruction ===")
            expect(message).not.toContain("Old instruction")
            expect(mockUpdateState).toHaveBeenCalledTimes(1)
            const updateArgs = mockUpdateState.mock.calls[0]
            const updaterFn = (updateArgs[1] as unknown as (state: StateWithIdempotencyTokens, ..._rest: any[]) => any)
            const tokenInput = { idempotencyTokens: { "instruction_load:/old/file.ts": "2026-01-01T00:00:00Z" } as any } as StateWithIdempotencyTokens

            expect(
                Object.keys(updaterFn(tokenInput).idempotencyTokens ?? {}).length
            ).toBe(2)
        })

        it("updates sessionStorage with new tokens after sending", async () => {
            vi.mocked(mockReadState).mockImplementation((sessionId: string, reader: (state: StateWithIdempotencyTokens) => Record<string, string>) => {
                const state = { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } }
                return reader(state as StateWithIdempotencyTokens)
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/new/file.ts", "New instruction"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1", callID: "call-update" },
                { args: { filePath: "/new/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            expect(mockUpdateState).toHaveBeenCalledTimes(1)
            const updateArgs = mockUpdateState.mock.calls[0]
            const updater = updateArgs[1] as (state: StateWithIdempotencyTokens, ..._rest: unknown[]) => any
            // The updater receives the read state and merges new tokens into it
            const testState = { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } } as StateWithIdempotencyTokens
            expect(Object.keys(updater(testState).idempotencyTokens ?? {}).length).toBe(2)
        })

        it("handles undefined stored idempotencyTokens gracefully", async () => {
            // readState returns an object where idempotencyTokens is explicitly undefined
            vi.mocked(mockReadState).mockImplementation((sessionId: string, reader: (state: StateWithIdempotencyTokens) => Record<string, string>) => {
                const state = { idempotencyTokens: undefined }
                return reader(state as unknown as StateWithIdempotencyTokens)
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Instruction A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Instruction B", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "Instruction C", applyTo: "**/*.{ts}" },
                ] as unknown as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]>,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1", callID: "call-undefined" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("Instruction A")
            expect(message).toContain("Instruction B")
            expect(message).toContain("Instruction C")
            // updateState should be called with all 3 tokens merged
            const updateArgs = mockUpdateState.mock.calls[0]
            const updater = updateArgs[1] as (state: StateWithIdempotencyTokens) => StateWithIdempotencyTokens
            const updaterResult = updater({ idempotencyTokens: undefined } as StateWithIdempotencyTokens)
            expect(updaterResult.idempotencyTokens).toBeDefined()
            expect(Object.keys(updaterResult.idempotencyTokens ?? {}).length).toBe(3)
        })

        it("formats instruction blocks with === INSTRUCTION: header", async () => {
            vi.mocked(mockReadState).mockImplementation((sessionId: string, reader: (state: StateWithIdempotencyTokens) => Record<string, string>) => {
                // No stored tokens — all instructions should be sent
                return reader({} as StateWithIdempotencyTokens)
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Alpha Rule", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Beta Rule", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "Gamma Rule", applyTo: "**/*.{ts}" },
                ] as unknown as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]>,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory } as any)
            const hookFn = plugin["tool.execute.before"]!
            await hookFn(
                { tool: "write", sessionID: "sess-1", callID: "call-format" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Verify the formatted block pattern: === INSTRUCTION: <desc> === and --- separator
            expect(message).toContain("=== INSTRUCTION:")
            expect(message).toContain("---")
            expect(mockUpdateState).toHaveBeenCalledTimes(1)
            const updateArgs = mockUpdateState.mock.calls[0]
            const updater = updateArgs[1] as (state: StateWithIdempotencyTokens, ..._rest: unknown[]) => any
            const result = updater({} as StateWithIdempotencyTokens)
            expect(Object.keys(result.idempotencyTokens ?? {})).toHaveLength(3)
        })
    })
})
