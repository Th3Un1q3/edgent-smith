 
import { beforeEach, describe, expect, it, vi } from "vitest"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock factories — synchronous imports avoid circular dependency issues.
import { defaultCreateClient, type ClientMock } from "./helpers/mock-utilities"
import { makeKvStoreMockFactory } from "./__utils/kv-store.mock"

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

import { SessionStorage } from "../helpers/kv-store"


// Helper to build mock instructions with the correct shape.
const makeInstructions = (path: string, description: string) => [
    { path, description, applyTo: "**/*.{ts}" },
] as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]> extends () => Promise<infer T> ? T : never

describe("instructionsLoaderPlugin", () => {
    let client: ClientMock
    const directory = "/workspace"

    beforeEach(() => {
        SessionStorage.reset()
        client = defaultCreateClient()
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

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
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

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "ls", sessionID: "sess-1", callID: "call-ls" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("skips when no sessionID is provided", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test instruction"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                ({ tool: "write", callID: "call-1" } as any), // missing sessionID to test the guard clause
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("skips when output.args.filePath is missing", async () => {
            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-1", callID: "call-1" }, // missing args.filePath — testing the guard clause
                {} as Parameters<typeof hookFunction>[1], // no args — testing the guard clause
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("returns zero instructions when no file paths match the index", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [],
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
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
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-no-agent", callID: "call-build-default" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledWith(expect.objectContaining({ agent: "build" }))
        })

        it("reuses the cached index for repeated calls with the same default agent", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            // First call — creates index for default agent
            await hookFunction(
                { tool: "write", sessionID: "sess-a", callID: "call-first" },
                { args: { filePath: "/some/file.ts" } },
            )
            vi.mocked(sessionHelpers.sendMessage).mockClear()

            // Second call with a different session but same default agent — should reuse cached index
            await hookFunction(
                { tool: "write", sessionID: "sess-b", callID: "call-second" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
        })

        it("creates a separate index when the session agent differs from the default", async () => {
            // Client that returns agent: "copilot" for sess-copilot, undefined for others
            const copilotClient = defaultCreateClient()
            const getSpy = vi.spyOn(copilotClient.session, "get")
            getSpy.mockImplementation(async (_path: unknown) => {
                if ((_path as { path?: { id?: string } })?.path?.id === "sess-copilot") {
                    return { data: { agent: "copilot" } };
                }
                return { data: {} };
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client: copilotClient, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())

            // First call — default agent (build)
            await hookFunction(
                { tool: "write", sessionID: "sess-no-agent", callID: "call-build" },
                { args: { filePath: "/some/file.ts" } },
            )
            vi.mocked(sessionHelpers.sendMessage).mockClear()

            // Second call — different agent (copilot) should trigger new index creation
            await hookFunction(
                { tool: "write", sessionID: "sess-copilot", callID: "call-copilot" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(2)
        })

        it("never creates more indexes than unique agents across multiple sessions", async () => {
            const indexedAgents = new Set<string>()
            vi.mocked(instructionIndexer.createIndex).mockImplementation(async (options) => {
                indexedAgents.add(options.agent)
                return ({ forFiles: async () => [], loadBody: async (_path: string) => "" }) as any
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

                const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
                const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
                await hookFunction(
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
            SessionStorage.reset({ "sess-1": { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/some/file.ts", "Test instruction"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-1", callID: "call-1" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("sends only new instructions when some were previously sent", async () => {
            SessionStorage.reset({ "sess-1": { idempotencyTokens: { "instruction_load:/old/file.ts": "2026-01-01T00:00:00Z" } } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/old/file.ts", description: "Old instruction", applyTo: "**/*.{ts}" },
                    { path: "/new/file.ts", description: "New instruction", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-1", callID: "call-mixed" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("=== INSTRUCTION: New instruction ===")
            expect(message).not.toContain("Old instruction")
        })

        it("updates sessionStorage with new tokens after sending", async () => {
            const sessionId = "sess-1"

            SessionStorage.reset({ [sessionId]: { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeInstructions("/new/file.ts", "New instruction"),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)



            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)

            const idempotencyTokensBefore = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(sessionId, (state) => {
                return state.idempotencyTokens ?? {}
            })

            expect(idempotencyTokensBefore).not.toHaveProperty("instruction_load:/new/file.ts")
            expect(idempotencyTokensBefore).toHaveProperty("instruction_load:/some/file.ts")

            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-1", callID: "call-update" },
                { args: { filePath: "/new/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()

            const idempotencyTokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>("sess-1", (state) => {
                return state.idempotencyTokens ?? {}
            })

            expect(idempotencyTokens).toHaveProperty("instruction_load:/some/file.ts")
            expect(idempotencyTokens).toHaveProperty("instruction_load:/new/file.ts")
            expect(Object.keys(idempotencyTokens ?? {}).length).toBe(2)
            expect(idempotencyTokens?.["instruction_load:/new/file.ts"]).toBeDefined()
            expect(idempotencyTokens?.["instruction_load:/some/file.ts"]).toBeDefined()
            expect(idempotencyTokens?.["instruction_load:/new/file.ts"]).toEqual(expect.any(String))
            expect(idempotencyTokens?.["instruction_load:/some/file.ts"]).toEqual(expect.any(String))
        })

        it("handles undefined stored idempotencyTokens gracefully", async () => {
            const sessionId = "sess-1"
            SessionStorage.reset({ [sessionId]: { idempotencyTokens: undefined } })
            // readState returns an object where idempotencyTokens is explicitly undefined

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Instruction A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Instruction B", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "Instruction C", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-1", callID: "call-undefined" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("Instruction A")
            expect(message).toContain("Instruction B")
            expect(message).toContain("Instruction C")

            expect((new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(sessionId, (state) => state.idempotencyTokens ?? {})).toEqual({
                "instruction_load:/a.ts": expect.any(String),
                "instruction_load:/b.ts": expect.any(String),
                "instruction_load:/c.ts": expect.any(String),
            })
        })

        it("formats instruction blocks with === INSTRUCTION: header", async () => {
            SessionStorage.reset({ "sess-1": { idempotencyTokens: {} } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Alpha Rule", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Beta Rule", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "Gamma Rule", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-1", callID: "call-format" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Verify the formatted block pattern: === INSTRUCTION: <desc> === and --- separator
            expect(message).toContain("=== INSTRUCTION:")
            expect(message).toContain("---")

        })
    })
})
