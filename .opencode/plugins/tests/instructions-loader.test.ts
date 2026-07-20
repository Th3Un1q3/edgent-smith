
import { beforeEach, describe, expect, it, vi } from "vitest"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock factories — synchronous imports avoid circular dependency issues.
import { defaultCreateClient, type ClientMock } from "@tests/helpers/mock-utilities"
import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"

// Step 1: declare mocks at file top (vitest hoists these automatically)
vi.mock("@plugins/helpers/instruction-indexer", () => ({ createIndex: vi.fn() }))
vi.mock("@plugins/helpers/session-helpers")
vi.mock("@plugins/helpers/logger")
vi.mock(
    "@plugins/helpers/kv-store",
    () => makeKvStoreMockFactory(),
)

// Step 2: import stubs — must come AFTER vi.mock() calls
import { instructionsLoaderPlugin, type StateWithIdempotencyTokens } from "@plugins/instructions-loader"
import * as instructionIndexer from "@plugins/helpers/instruction-indexer"
import * as sessionHelpers from "@plugins/helpers/session-helpers"

import { SessionStorage } from "@plugins/helpers/kv-store"


// Helper to build mock instructions with the correct shape.
const makeInstructions = (path: string, description: string) => [
    { path, description, applyTo: "**/*.{ts}" },
] as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]> extends () => Promise<infer T> ? T : never

/** Build 6 instructions for session-aware budget tests. */
const makeFiveInstructions = () => [
    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
    { path: "/c.ts", description: "Inst C", applyTo: "**/*.{ts}" },
    { path: "/d.ts", description: "Inst D", applyTo: "**/*.{ts}" },
    { path: "/e.ts", description: "Inst E", applyTo: "**/*.{ts}" },
    { path: "/f.ts", description: "Inst F", applyTo: "**/*.{ts}" },
] as any

/** Helper to read the message and extract which instructions were injected with content. */
function getInjectedDescriptions(message: string): Array<{ desc: string; hasContent: boolean }> {
    const blocks = message.split("=== INSTRUCTION:")
    return blocks.slice(1).map(block => {
        // Trim leading/trailing whitespace from each split block to remove delimiter artifacts
        const trimmedBlock = block.trim()
        if (trimmedBlock.length === 0) return undefined as any
        const descLine = trimmedBlock.split("\n", 1)[0]
        const desc = descLine.replace(/ ===/, "")
        // Check if there's content after the --- separator (reference-only has empty body)
        const afterDesc = trimmedBlock.slice(Math.max(0, descLine.length + 1))
        const afterSeparator = afterDesc.indexOf("---")
        const bodyAfterSeparator = afterSeparator === -1 ? "" : afterDesc.slice(Math.max(0, afterSeparator + 3))
        // Content is non-empty only if there's actual text on lines that aren't metadata or the closing divider
        const hasContent = bodyAfterSeparator.split("\n").some(line => {
            const trimmed = line.trim()
            return (
                trimmed.length > 0 &&
                !trimmed.startsWith("Source") &&
                !trimmed.startsWith("===") &&
                !trimmed.startsWith("---") &&
                trimmed !== "=".repeat(28) &&
                // Ignore any closing tags or message wrappers that bleed into the split block
                !trimmed.startsWith("</") &&
                !trimmed.startsWith("<")
            )
        })
        return { desc, hasContent }
    })
}

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

            // Legacy token preserved unchanged; new instruction recorded with :full suffix
            expect(idempotencyTokens).toHaveProperty("instruction_load:/some/file.ts")
            expect(idempotencyTokens).toHaveProperty("instruction_load:/new/file.ts:full")
            expect(Object.keys(idempotencyTokens ?? {}).length).toBe(2)
            expect(idempotencyTokens?.["instruction_load:/new/file.ts:full"]).toBeDefined()
            expect(idempotencyTokens?.["instruction_load:/some/file.ts"]).toBeDefined()
            expect(idempotencyTokens?.["instruction_load:/new/file.ts:full"]).toEqual(expect.any(String))
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
                "instruction_load:/a.ts:full": expect.any(String),
                "instruction_load:/b.ts:full": expect.any(String),
                "instruction_load:/c.ts:full": expect.any(String),
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

    // ════════════════════════════════════════════════════════════
    // Session-aware 5-slot budget (Phase 3)
    // ════════════════════════════════════════════════════════════

    describe("session-aware 5-slot budget", () => {
        it.each([
            { name: "write", tool: "write" },
            { name: "edit", tool: "edit" },
            { name: "read", tool: "read" },
        ])("injects up to 5 full-content instructions in empty session for '$name'", async ({ tool }) => {
            SessionStorage.reset({ "sess-empty": {} })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => makeFiveInstructions(),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool, sessionID: "sess-empty", callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // 5 instructions with content + 6th reference-only
            expect(injected.length).toBe(6)
        })

        it("injects new instruction with full content when fewer than 5 tokens exist", async () => {
            SessionStorage.reset({
                "sess-partial": {
                    idempotencyTokens: {
                        "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev2.ts:ref": "2026-01-01T00:00:00Z",
                    }
                }
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-partial", callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // Both should have content (2 existing full tokens → 3 remaining slots, 2 new instructions fit)
            expect(injected.length).toBe(2)
            expect(injected.every(index => index.hasContent)).toBe(true)

            // Verify tokens stored with suffixes
            const updatedTokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
                "sess-partial", (s) => s.idempotencyTokens ?? {}
            )
            expect(updatedTokens).toHaveProperty("instruction_load:/a.ts:full")
            expect(updatedTokens).toHaveProperty("instruction_load:/b.ts:full")
        })

        it("injects new instruction as reference-only when 5 full tokens already present", async () => {
            SessionStorage.reset({
                "sess-full": {
                    idempotencyTokens: {
                        "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev2.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev3.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev4.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev5.ts:full": "2026-01-01T00:00:00Z",
                    }
                }
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-full", callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // Both should be reference-only (no content)
            expect(injected.length).toBe(2)
            expect(injected.every(index => !index.hasContent)).toBe(true)

            // Verify tokens stored with :ref suffix
            const updatedTokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
                "sess-full", (s) => s.idempotencyTokens ?? {}
            )
            expect(updatedTokens).toHaveProperty("instruction_load:/a.ts:ref")
            expect(updatedTokens).toHaveProperty("instruction_load:/b.ts:ref")
        })

        it("legacy tokens without suffix prevent re-injection but do not consume budget slots", async () => {
            SessionStorage.reset({
                "sess-legacy": {
                    idempotencyTokens: {
                        "instruction_load:/prev1.ts": "2026-01-01T00:00:00Z", // legacy — no suffix
                        "instruction_load:/prev2.ts": "2026-01-01T00:00:00Z", // legacy — no suffix
                    }
                }
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "Inst C", applyTo: "**/*.{ts}" },
                    { path: "/d.ts", description: "Inst D", applyTo: "**/*.{ts}" },
                    { path: "/e.ts", description: "Inst E", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-legacy", callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // All 5 instructions should be injected with content because legacy tokens don't count toward the budget
            const injected = getInjectedDescriptions(message)
            expect(injected.length).toBe(5)

            // Verify they got :full suffixes (legacy token blocked re-injection, but slot was still available for new ones)
            const updatedTokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
                "sess-legacy", (s) => s.idempotencyTokens ?? {}
            )
            expect(updatedTokens).toHaveProperty("instruction_load:/a.ts:full")
            // Legacy tokens should still be present unchanged
            expect(updatedTokens).toHaveProperty("instruction_load:/prev1.ts")
            expect(updatedTokens).toHaveProperty("instruction_load:/prev2.ts")
        })

        it("exactly hits the cap boundary at slot 5", async () => {
            SessionStorage.reset({
                "sess-boundary": {
                    idempotencyTokens: {
                        "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev2.ts:ref": "2026-01-01T00:00:00Z", // ref doesn't consume slot
                    }
                }
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "Inst C", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-boundary", callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // 4 remaining slots: 2 full + ref doesn't count → 3 new instructions, first 3 get content, last gets ref
            expect(injected.length).toBe(3)
        })

        it("session survives restart with pre-populated state", async () => {
            const sessionID = "sess-survive"

            // Populate initial state simulating previous session runs
            SessionStorage.reset({
                [sessionID]: {
                    idempotencyTokens: {
                        "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev2.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev3.ts:full": "2026-01-01T00:00:00Z",
                    }
                }
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin1 = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction1 = plugin1?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction1(
                { tool: "write", sessionID, callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            // Verify 2 remaining slots (5 - 3 full = 2), so this first instruction gets content
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("Inst A")

            vi.mocked(sessionHelpers.sendMessage).mockClear()

            // Simulate session restart — new plugin instance reading same state
            SessionStorage.reset({
                [sessionID]: {
                    idempotencyTokens: {
                        "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev2.ts:full": "2026-01-01T00:00:00Z",
                        "instruction_load:/prev3.ts:full": "2026-01-01T00:00:00Z",
                        // Token from previous call in this session
                        "instruction_load:/a.ts:full": "2026-07-01T00:00:00Z",
                    }
                }
            })

            const plugin2 = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction2 = plugin2?.["tool.execute.before"] ?? (() => Promise.resolve())

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            await hookFunction2(
                { tool: "write", sessionID, callID: "call-2" },
                { args: { filePath: "/b.ts" } },
            )

            // Now at 4 full tokens + ref from prev3 → only 1 more slot for /b.ts → gets content
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("new session starts fresh", async () => {
            SessionStorage.reset({ "sess-new": {} })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                ] as any,
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin(({ client, directory }) as any)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(
                { tool: "write", sessionID: "sess-new", callID: "call-1" },
                { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // Fresh session — both should have content
            expect(injected.length).toBe(2)

            // Verify tokens stored with :full suffixes in fresh session
            const updatedTokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
                "sess-new", (s) => s.idempotencyTokens ?? {}
            )
            expect(updatedTokens).toHaveProperty("instruction_load:/a.ts:full")
            expect(updatedTokens).toHaveProperty("instruction_load:/b.ts:full")
        })
    })
})
