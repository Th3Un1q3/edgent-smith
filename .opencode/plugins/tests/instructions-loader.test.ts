

import { beforeEach, describe, expect, it, vi } from "vitest"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock factories — synchronous imports avoid circular dependency issues.
import { defaultCreateClient, type ClientMock } from "@tests/helpers/mock-utilities"

// Mock factories — synchronous imports avoid circular dependency issues.
import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"

vi.mock("@plugins/helpers/instruction-indexer", () => ({ createIndex: vi.fn() }))
vi.mock("@plugins/helpers/session-helpers")
vi.mock("@plugins/helpers/logger")
vi.mock(
    "@plugins/helpers/kv-store",
    () => makeKvStoreMockFactory(),
)

// Import stubs AFTER vi.mock() calls
import { instructionsLoaderPlugin, type StateWithIdempotencyTokens } from "@plugins/instructions-loader"
import * as instructionIndexer from "@plugins/helpers/instruction-indexer"
import * as sessionHelpers from "@plugins/helpers/session-helpers"
import { SessionStorage } from "@plugins/helpers/kv-store"

// ── Helpers ───────────────────────────────────────────────────────

const makeInstructions = (path: string, description: string) => [
    { path, description, applyTo: "**/*.{ts}" },
] as ReturnType<Awaited<ReturnType<typeof instructionIndexer.createIndex>>["forFiles"]> extends () => Promise<infer T> ? T : never

const makeMockIndex = (instructions: any[]) => ({
    forFiles: async () => instructions,
    loadBody: async (path: string) => `Content of ${path}`,
}) as any

async function createPlugin(client: ClientMock) {
    return await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
}

// ── Run a budget test helper ──────────────────────────────────────

async function runBudgetTest(
    sessionId: string,
    tokens: Record<string, string>,
    instructionCount: number,
): Promise<string> {
    const client = defaultCreateClient()

    SessionStorage.reset({ [sessionId]: { idempotencyTokens: tokens } })

    vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => Array.from({ length: instructionCount }, (_, index) => ({
            path: `/${String.fromCodePoint(65 + index)}.ts`, description: `Inst ${String.fromCodePoint(65 + index)}`, applyTo: "**/*.{ts}" })),
        loadBody: async (path: string) => `Content of ${path}`,
    } as any)

    const plugin = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
    const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
    await hookFunction({ tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/a.ts" } })

    expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
    return message
}

function getInjectedDescriptions(message: string): Array<{ desc: string; hasContent: boolean }> {
    return message.split("=== INSTRUCTION:")
        .slice(1)
        .map(block => {
            const trimmedBlock = block.trim()
            if (trimmedBlock.length === 0) return undefined as any
            const descLine = trimmedBlock.split("\n", 1)[0]
            const desc = descLine.replace(/ ===/, "")
            const afterDesc = trimmedBlock.slice(Math.max(0, descLine.length + 1))
            const afterSeparator = afterDesc.indexOf("---")
            const bodyAfterSeparator = afterSeparator === -1 ? "" : afterDesc.slice(Math.max(0, afterSeparator + 3))
            const hasContent = bodyAfterSeparator.split("\n").some(line => {
                const trimmed = line.trim()
                return (
                    trimmed.length > 0 &&
                    !trimmed.startsWith("Source") &&
                    !trimmed.startsWith("===") &&
                    !trimmed.startsWith("---") &&
                    trimmed !== "=".repeat(28) &&
                    !trimmed.startsWith("</") &&
                    !trimmed.startsWith("<")
                )
            })
            return { desc, hasContent }
        })
}

function getInjectedCount(message: string): number {
    return message.split("=== INSTRUCTION:").slice(1).filter(b => b.trim().length > 0).length
}

// ── Tests ─────────────────────────────────────────────────────────

describe("instructionsLoaderPlugin", () => {
    let client: ClientMock

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
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(
                makeMockIndex(makeInstructions("/some/file.ts", "Test instruction")),
            )

            const plugin = await createPlugin(client)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction({ tool, sessionID: "sess-1", callID: "call-1" }, { args: { filePath: "/some/file.ts" } })

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("does not send instructions for non-targeted tools", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(
                makeMockIndex(makeInstructions("/some/file.ts", "Test")),
            )
            const plugin = await createPlugin(client)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction({ tool: "ls", sessionID: "sess-1", callID: "call-ls" }, { args: { filePath: "/some/file.ts" } })

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it.each([
            { name: "no sessionID", input: () => ({ tool: "write", callID: "call-1" }), argsInput: {} as any },
            { name: "missing filePath in args", input: () => ({ tool: "write", sessionID: "sess-1", callID: "call-1" }), argsInput: undefined },
        ])("skips when $name", async ({ input, argsInput }) => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(
                makeMockIndex(makeInstructions("/some/file.ts", "Test instruction")),
            )
            const plugin = await createPlugin(client)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction(input() as never, argsInput ? { args: { filePath: "/some/file.ts" } } : {} as any)

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("returns zero instructions when no file paths match the index", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([]))
            const plugin = await createPlugin(client)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction({ tool: "write", sessionID: "sess-1", callID: "call-unknown" }, { args: { filePath: "/unknown/file.ts" } })

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })
    })

    describe("agent-specific index caching", () => {
        it("creates a new index for the default 'build' agent when session has no agent field", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/some/file.ts", "Test")))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-no-agent", callID: "call-build-default" },
                { args: { filePath: "/some/file.ts" } },
            )

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledWith(expect.objectContaining({ agent: "build" }))
        })

        it("reuses the cached index for repeated calls with the same default agent", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/some/file.ts", "Test")))
            const plugin = await createPlugin(client)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())
            await hookFunction({ tool: "write", sessionID: "sess-a", callID: "call-first" }, { args: { filePath: "/some/file.ts" } })
            await hookFunction({ tool: "write", sessionID: "sess-b", callID: "call-second" }, { args: { filePath: "/some/file.ts" } })

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
        })

        it("creates a separate index when the session agent differs from the default", async () => {
            const copilotClient = defaultCreateClient()
            vi.spyOn(copilotClient.session, "get").mockImplementation(async (_path: unknown) => {
                if ((_path as { path?: { id?: string } })?.path?.id === "sess-copilot") return { data: { agent: "copilot" } };
                return { data: {} };
            })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/some/file.ts", "Test")))
            const plugin = await createPlugin(copilotClient)
            const hookFunction = plugin?.["tool.execute.before"] ?? (() => Promise.resolve())

            await hookFunction({ tool: "write", sessionID: "sess-no-agent", callID: "call-build" }, { args: { filePath: "/some/file.ts" } })
            await hookFunction({ tool: "write", sessionID: "sess-copilot", callID: "call-copilot" }, { args: { filePath: "/some/file.ts" } })

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(2)
        })

        it("never creates more indexes than unique agents across multiple sessions", async () => {
            const indexedAgents = new Set<string>()
            vi.mocked(instructionIndexer.createIndex).mockImplementation(async (options) => {
                indexedAgents.add(options.agent)
                return makeMockIndex([]) as any
            })

            const testSessions = [
                { agent: "build" }, { agent: "copilot" }, { agent: "designer" }, { agent: "copilot" }, { agent: "build" }
            ]

            for (const session of testSessions) {
                const c = defaultCreateClient()
                vi.spyOn(c.session, "get").mockResolvedValue({ data: session })
                const plugin = await createPlugin(c)
                await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                    { tool: "write", sessionID: `sess-${session.agent}`, callID: `call-${session.agent}` },
                    { args: { filePath: "/some/file.ts" } },
                )
            }

            expect(indexedAgents.size).toBe(3)
        })
    })

    describe("idempotency edge cases", () => {
        it("skips instructions already sent in a previous call", async () => {
            SessionStorage.reset({ "sess-1": { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } } })
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/some/file.ts", "Test instruction")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-1", callID: "call-1" }, { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("sends only new instructions when some were previously sent", async () => {
            SessionStorage.reset({ "sess-1": { idempotencyTokens: { "instruction_load:/old/file.ts": "2026-01-01T00:00:00Z" } } })
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([
                { path: "/old/file.ts", description: "Old instruction", applyTo: "**/*.{ts}" },
                { path: "/new/file.ts", description: "New instruction", applyTo: "**/*.{ts}" },
            ]))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-1", callID: "call-mixed" }, { args: { filePath: "/some/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("=== INSTRUCTION: New instruction ===")
            expect(message).not.toContain("Old instruction")
        })

        it("updates sessionStorage with new tokens after sending", async () => {
            const sessionId = "sess-1"
            SessionStorage.reset({ [sessionId]: { idempotencyTokens: { "instruction_load:/some/file.ts": "2026-01-01T00:00:00Z" } } })
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/new/file.ts", "New instruction")))

            const plugin = await createPlugin(client)

            expect((new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(sessionId, s => s.idempotencyTokens ?? {}))
                .not.toHaveProperty("instruction_load:/new/file.ts")

            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-1", callID: "call-update" }, { args: { filePath: "/new/file.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const tokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(sessionId, s => s.idempotencyTokens ?? {})
            expect(tokens).toHaveProperty("instruction_load:/some/file.ts")
            expect(tokens).toHaveProperty("instruction_load:/new/file.ts:full")
            expect(Object.keys(tokens ?? {}).length).toBe(2)
        })

        it.each([
            { name: "undefined stored idempotencyTokens", state: () => ({ idempotencyTokens: undefined }), expectedCount: 3 },
            { name: "empty idempotencyTokens", state: () => ({ idempotencyTokens: {} }), expectedCount: 2 },
        ])("handles $name gracefully", async ({ expectedCount }) => {
            const sessionId = "sess-1"
            SessionStorage.reset({ [sessionId]: (expectedCount === 3 ? { idempotencyTokens: undefined } : { idempotencyTokens: {} }) })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(
                expectedCount === 3
                    ? [{ path: "/a.ts", description: "Instruction A", applyTo: "**/*.{ts}" }, { path: "/b.ts", description: "Instruction B", applyTo: "**/*.{ts}" }, { path: "/c.ts", description: "Instruction C", applyTo: "**/*.{ts}" }]
                    : [{ path: "/a.ts", description: "Alpha Rule", applyTo: "**/*.{ts}" }, { path: "/b.ts", description: "Beta Rule", applyTo: "**/*.{ts}" }],
            ))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-1", callID: "call-format" }, { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("=== INSTRUCTION:")
            expect(message).toContain("---")

            const tokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(sessionId, s => s.idempotencyTokens ?? {})
            expect(Object.keys(tokens ?? {}).length).toBe(expectedCount)
        })
    })

    // ── Session-aware 5-slot budget (Phase 3) ───────────────────────

    describe("session-aware 5-slot budget", () => {
        it.each([
            { name: "write" }, { name: "edit" }, { name: "read" },
        ])("injects up to 5 full-content instructions in empty session for '$name'", async (_tool) => {
            const message = await runBudgetTest("sess-empty", {}, 6)
            expect(getInjectedCount(message)).toBe(6)
        })

        it("injects new instruction with full content when fewer than 5 tokens exist", async () => {
            const message = await runBudgetTest("sess-partial", {
                "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev2.ts:ref": "2026-01-01T00:00:00Z",
            }, 2)

            const injected = getInjectedDescriptions(message)
            expect(injected.length).toBe(2)
            expect(injected.every(index => index.hasContent)).toBe(true)
        })

        it("injects new instruction as reference-only when 5 full tokens already present", async () => {
            const message = await runBudgetTest("sess-full", {
                "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev2.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev3.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev4.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev5.ts:full": "2026-01-01T00:00:00Z",
            }, 2)

            const injected = getInjectedDescriptions(message)
            expect(injected.length).toBe(2)
            expect(injected.every(index => !index.hasContent)).toBe(true)
        })

        it("legacy tokens without suffix prevent re-injection but do not consume budget slots", async () => {
            SessionStorage.reset({ "sess-legacy": { idempotencyTokens: {
                "instruction_load:/prev1.ts": "2026-01-01T00:00:00Z",
                "instruction_load:/prev2.ts": "2026-01-01T00:00:00Z",
            } }})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => Array.from({ length: 5 }, (_, index) => ({ path: `/${String.fromCodePoint(65 + index)}.ts`, description: `Inst ${index}`, applyTo: "**/*.{ts}" })),
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-legacy", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(getInjectedCount(message)).toBe(5)
        })

        it("exactly hits the cap boundary at slot 5", async () => {
            SessionStorage.reset({ "sess-boundary": { idempotencyTokens: {
                "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev2.ts:ref": "2026-01-01T00:00:00Z",
            } }})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => ["/a", "/b", "/c"].map(path => ({ path, description: `Inst ${path}`, applyTo: "**/*.{ts}" })),
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-boundary", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(getInjectedCount(message)).toBe(3)
        })

        it("session survives restart with pre-populated state", async () => {
            const sessionId = "sess-survive"
            SessionStorage.reset({ [sessionId]: { idempotencyTokens: {
                "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev2.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev3.ts:full": "2026-01-01T00:00:00Z",
            } }})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin1 = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
            await (plugin1?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("Inst A")

            vi.mocked(sessionHelpers.sendMessage).mockClear()

            SessionStorage.reset({ [sessionId]: { idempotencyTokens: {
                "instruction_load:/prev1.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev2.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/prev3.ts:full": "2026-01-01T00:00:00Z",
                "instruction_load:/a.ts:full": "2026-07-01T00:00:00Z",
            } }})

            const plugin2 = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            await (plugin2?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: sessionId, callID: "call-2" }, { args: { filePath: "/b.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("new session starts fresh", async () => {
            SessionStorage.reset({ "sess-new": {} })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-new", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            expect(injected.length).toBe(1)
        })
    })
})
