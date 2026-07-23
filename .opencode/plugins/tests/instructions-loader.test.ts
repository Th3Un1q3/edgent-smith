

import { beforeEach, describe, expect, it, vi } from "vitest"

 
 

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
import { log } from "@plugins/helpers/logger"
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
    return message.split("<instruction>")
        .slice(1)
        .map(block => {
            const trimmedBlock = block.trim()
            if (trimmedBlock.length === 0) return undefined as any
            const descMatch = trimmedBlock.match(/<description>(.*?)<\/description>/s)
            const desc = descMatch ? descMatch[1].trim() : ""
            // Full-content blocks have a <content> element; reference-only blocks have <meta/> instead
            const hasContent = trimmedBlock.includes("<content>")
            return { desc, hasContent }
        })
}

function getInjectedCount(message: string): number {
    return message.split("<instruction>").slice(1).filter(b => b.trim().length > 0).length
}

// ── Tests ─────────────────────────────────────────────────────────

describe("instructionsLoaderPlugin", () => {
    let client: ClientMock

    beforeEach(() => {
        vi.clearAllMocks()
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
            expect(log).toHaveBeenCalledWith(expect.anything(), "info", expect.stringContaining("No new instructions to send for session sess-1"))
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
            expect(message).toContain("<description>New instruction</description>")
            expect(message).not.toContain("<description>Old instruction</description>")
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
            expect(message).toContain("<instruction>")
            expect(message).toContain("<content>")

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
    // ── Mutation coverage: targeted tests for surviving mutants ─────────────

    describe("createIndex call arguments", () => {
        it("passes the correct instructionsGlob and type to createIndex", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-a", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )
            const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
            expect(call.instructionsGlob).toBe(".opencode/instructions/*.instructions.md")
            expect(call.type).toBe("custom")
        })

        it("passes a log function to createIndex", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-log", callID: "call-log" }, { args: { filePath: "/f.ts" } },
            )
            const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
            expect(call.log).toBeInstanceOf(Function)
        })

        it("the log callback actually invokes the logger", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-log-cb", callID: "call-cb" }, { args: { filePath: "/f.ts" } },
            )
            const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
            // Invoke the log callback to verify it calls the mocked log function
            ;(call.log as (message: string) => void)("test message")
            expect(log).toHaveBeenCalledWith(expect.anything(), "info", expect.stringContaining("test message"))
        })
    })

    describe("session agent resolution", () => {
        it("defaults to 'build' agent when session.get returns null", async () => {
            vi.mocked(client.session.get).mockResolvedValue(undefined as unknown as { data?: Record<string, unknown> })
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await expect(
                (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                    { tool: "write", sessionID: "sess-null", callID: "call-1" }, { args: { filePath: "/f.ts" } },
                ),
            ).resolves.not.toThrow()

            expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledWith(
                expect.objectContaining({ agent: "build" }),
            )
        })
    })

    describe("budget counting only counts :full tokens", () => {
        it("does not count :ref suffixed tokens as budget consumers", async () => {
            SessionStorage.reset({ "sess-ref": { idempotencyTokens: {
                "instruction_load:/x.ts:ref": "ts",
                "instruction_load:/y.ts:ref": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/a.ts", description: "A", applyTo: "**/*.{ts}" }],
                loadBody: async (path: string) => `Content of ${path}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-ref", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            // :ref tokens don't consume budget, so 0 full tokens → slot available → full content
            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("<content>")
        })
    })

    describe("isAlreadyInjected recognizes suffixed tokens", () => {
        it.each([
            { name: ":full suffix", key: "instruction_load:/a.ts:full" as const },
            { name: ":ref suffix", key: "instruction_load:/a.ts:ref" as const },
        ])("skips instruction when idempotency token has $name", async ({ key }) => {
            SessionStorage.reset({ "sess-sfx": { idempotencyTokens: { [key]: "ts" }}})
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([
                { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
            ]))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-sfx", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
        })

        it("does NOT skip instruction when idempotency token suffix does not match :full or :ref", async () => {
            SessionStorage.reset({ "sess-other": { idempotencyTokens: { "instruction_load:/a.ts:other": "ts" }}})
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([
                { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
            ]))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-other", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            // ":other" is not :full or :ref, so not recognized as injected → message sent
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })
    })

    describe("slot boundary and content format", () => {
        it("distributes full vs reference slots at exact boundary", async () => {
            SessionStorage.reset({ "sess-bound2": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts",
                "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts",
                "instruction_load:/f4.ts:full": "ts",
            }}})
            // 4 full tokens → remainingSlots = 1

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "B", applyTo: "**/*.{ts}" },
                ],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-bound2", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            expect(injected.length).toBe(2)
            expect(injected[0].hasContent).toBe(true)  // slot 5: full
            expect(injected[1].hasContent).toBe(false) // slot 6: reference (no slots left)
        })

        it("includes actual content text in full-format instruction blocks", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-content", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("Content of /f.ts")
        })

        it("does NOT include content text in reference-only instruction blocks", async () => {
            SessionStorage.reset({ "sess-ref-no-content": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/new.ts", description: "New", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-ref-no-content", callID: "call-1" }, { args: { filePath: "/new.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).not.toContain("Content of /new.ts")
        })
    })

    describe("sendMessage and token format", () => {
        it("calls sendMessage with noReply set to true", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-noreply", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledWith(
                expect.objectContaining({ noReply: true }),
            )
        })

        it("records token keys ending with :full for full instructions", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-tok-full", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const tokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
                "sess-tok-full", s => s.idempotencyTokens ?? {},
            )
            const keys = Object.keys(tokens ?? {})
            expect(keys.some(k => k.endsWith(":full"))).toBe(true)
        })

        it("records token keys ending with :ref for reference instructions", async () => {
            SessionStorage.reset({ "sess-tok-ref": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/new.ts", description: "New", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-tok-ref", callID: "call-1" }, { args: { filePath: "/new.ts" } },
            )

            const tokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
                "sess-tok-ref", s => s.idempotencyTokens ?? {},
            )
            const keys = Object.keys(tokens ?? {})
            const newKeys = keys.filter(k => k.startsWith("instruction_load:/new.ts"))
            expect(newKeys.length).toBe(1)
            expect(newKeys[0]).toContain(":ref")
        })
    })

    // ── XML output format & string literal coverage ─────────────────────

    describe("steering message format", () => {
        it("wraps instructions in a steering element with priority, reason, and type attributes", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-steering", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain('<steering priority="high" reason="relevant files touched" type="instructions">')
            expect(message).toContain('</steering>')
        })
    })

    describe("plugin ID in log messages", () => {
        it("includes [instructions-loader] prefix when logging no-new-instructions", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([]))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-log-1", callID: "call-1" }, { args: { filePath: "/none.ts" } },
            )

            expect(log).toHaveBeenCalledWith(expect.anything(), "info", expect.stringContaining("[instructions-loader]"))
        })

        it("includes [instructions-loader] prefix in the createIndex log callback", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-log-cb2", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
            ;(call.log as (message: string) => void)("index built")
            expect(log).toHaveBeenCalledWith(expect.anything(), "info", "[instructions-loader] index built")
        })
    })

    describe("XML tag structure in full-content instruction blocks", () => {
        it("renders instruction blocks with <instruction>, <description>, <path>, <content>, </content>, </instruction> tags", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test Desc")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-xml-full", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("<instruction>")
            expect(message).toContain("</instruction>")
            expect(message).toContain("<description>Test Desc</description>")
            expect(message).toContain("<path>/f.ts</path>")
            expect(message).toContain("<content>")
            expect(message).toContain("</content>")
            expect(message).not.toContain("<meta")
        })

        it("renders empty content element when instruction body is undefined", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/empty.ts", description: "Empty Body", applyTo: "**/*.{ts}" }],
                loadBody: async () => undefined as unknown as string,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-empty-body", callID: "call-1" }, { args: { filePath: "/empty.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Between <content> and </content> there should be no content text, just the closing tag
            expect(message).toContain("<content>")
            expect(message).toContain("</content>")
            expect(message).not.toContain("Content of /empty.ts")
        })
    })

    describe("XML tag structure in reference-only instruction blocks", () => {
        it("renders <instruction>, <description>, <path>, <meta/>, </instruction> tags and omits <content>", async () => {
            SessionStorage.reset({ "sess-xml-ref": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/ref.ts", description: "Ref Desc", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-xml-ref", callID: "call-1" }, { args: { filePath: "/ref.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("<instruction>")
            expect(message).toContain("</instruction>")
            expect(message).toContain("<description>Ref Desc</description>")
            expect(message).toContain("<path>/ref.ts</path>")
            expect(message).toContain("<meta")
            expect(message).toContain("/>")
            expect(message).not.toContain("<content>")
        })

        it("includes lines and chars attributes in the meta tag when content exists", async () => {
            SessionStorage.reset({ "sess-meta-attrs": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            const contentBody = "line1\nline2"
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/m.ts", description: "Meta Test", applyTo: "**/*.{ts}" }],
                loadBody: async () => contentBody,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-meta-attrs", callID: "call-1" }, { args: { filePath: "/m.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain('lines="2"')
            expect(message).toContain('chars="11"')
        })

        it("omits lines/chars attributes in meta tag when content is falsy", async () => {
            SessionStorage.reset({ "sess-meta-empty": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/e.ts", description: "Empty Meta", applyTo: "**/*.{ts}" }],
                loadBody: async () => undefined as unknown as string,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-meta-empty", callID: "call-1" }, { args: { filePath: "/e.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toContain("<meta/>")
            expect(message).not.toContain("lines=")
            expect(message).not.toContain("chars=")
        })
    })

    describe("instruction block join separators", () => {
        it("separates multiple instruction blocks with double newlines", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "Inst A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "Inst B", applyTo: "**/*.{ts}" },
                ],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-sep", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // The two blocks should be separated by </instruction>\n\n<instruction>
            expect(message).toContain("</instruction>\n\n<instruction>")
        })

        it("joins lines within a single instruction block with single newlines", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Line Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-join", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Lines within a full-content block should be joined by \n
            const blockText = message.split("<instruction>", 2)[1] ?? ""
            // A full block has 7 lines: instruction, description, path, content, body, /content, /instruction
            expect(blockText).toMatch(/  <description>.*<\/description>\n  <path>.*<\/path>\n  <content>/)
        })
    })

    describe("idempotency token guard behavior", () => {
        it("returns empty object when state has no idempotencyTokens property", async () => {
            // Simulate state without idempotencyTokens at all
            const sessionId = "sess-no-prop"
            SessionStorage.reset({ [sessionId]: {} })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            // Should not throw and should send message (no idempotency block)
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("treats idempotencyTokens as valid when it contains entries", async () => {
            const sessionId = "sess-has-tokens"
            SessionStorage.reset({ [sessionId]: { idempotencyTokens: { "instruction_load:/existing.ts:full": "ts" } } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })
    })

    describe("steering steering message inline attributes", () => {
        it("includes the priority attribute set to high", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-prio", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            expect(message).toMatch(/<steering\s+[^>]*priority="high"/)
        })
    })

    // ── Targeted tests for surviving mutants ───────────────────────────

    describe("safePath guard for instructions with missing path and description", () => {
        it("still sends instructions when both path and description are falsy", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: undefined as unknown as string, description: undefined as unknown as string, applyTo: "**/*.{ts}" }],
                loadBody: async () => "body",
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-nopath", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })
    })

    describe("empty instruction body between content tags", () => {
        it("renders no text between <content> and </content> when body is undefined", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/e.ts", description: "E", applyTo: "**/*.{ts}" }],
                loadBody: async () => undefined as unknown as string,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-null-body", callID: "call-1" }, { args: { filePath: "/e.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Extract text between <content> and </content>
            const contentMatch = message.match(/<content>\n(.*?)\n  <\/content>/s)
            expect(contentMatch).not.toBeNull()
            expect(contentMatch?.[1]?.trim()).toBe("")
        })
    })

    describe("reference block internal newline separators", () => {
        it("uses newline separators between XML elements in reference blocks", async () => {
            SessionStorage.reset({ "sess-ref-nl": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/r.ts", description: "Ref", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-ref-nl", callID: "call-1" }, { args: { filePath: "/r.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Verify newlines between elements in reference block
            expect(message).toContain("<description>Ref</description>\n  <path>")
            expect(message).toContain("</path>\n  <meta")
            expect(message).toContain("/>\n</instruction>")
        })
    })

    describe(":full token filter requires the :full suffix", () => {
        it("only counts :full tokens toward the budget, not :ref or unsuffixed tokens", async () => {
            // 5 unsuffixed tokens + 5 :ref tokens = 10 non-:full tokens that should NOT consume budget
            const manyTokens: Record<string, string> = {}
            for (let index = 0; index < 5; index++) {
                manyTokens[`instruction_load:/legacy${index}.ts`] = "ts"
                manyTokens[`instruction_load:/ref${index}.ts:ref`] = "ts"
            }

            SessionStorage.reset({ "sess-filter": { idempotencyTokens: manyTokens } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "/new.ts", description: "New", applyTo: "**/*.{ts}" }],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-filter", callID: "call-1" }, { args: { filePath: "/new.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            // Budget slots should not be consumed by non-:full tokens → instruction gets full content
            expect(message).toContain("<content>")
        })
    })

    describe("slots remaining decrement exactly at isReference boundary", () => {
        it("does not decrement slotsRemaining once isReference is already true", async () => {
            // 5 full tokens = budget full → next instruction is reference
            SessionStorage.reset({ "sess-decr": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            }}})

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "B", applyTo: "**/*.{ts}" },
                ],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-decr", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // Both should be reference-only (no budget slots left)
            expect(injected.every(index => !index.hasContent)).toBe(true)
        })
    })

    describe("plugin ID in no-new-instructions log uses exact PLUGIN_ID value", () => {
        it("uses the exact [instructions-loader] prefix, not an empty or different plugin ID", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([]))
            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-plugid", callID: "call-1" }, { args: { filePath: "/no-match.ts" } },
            )

            // The log message must start exactly with [instructions-loader], not [] or [something-else]
            const logCalls = vi.mocked(log).mock.calls
            const noNewMessageCall = logCalls.find(c => typeof c[2] === "string" && (c[2] as string).includes("No new instructions to send"))
            expect(noNewMessageCall).toBeDefined()
            const logMessage = (noNewMessageCall as (typeof logCalls)[number])[2]
            expect(logMessage).toMatch(/^\[instructions-loader\]/)
        })
    })

    // ── Targeted tests for surviving mutants ──────────────────────────

    describe("readState idempotencyTokens guard (equivalent mutants)", () => {
        it("returns empty object when session state has undefined idempotencyTokens", async () => {
            const sessionId = "sess-undef-tokens"
            // State without idempotencyTokens — readState callback sees undefined
            SessionStorage.reset({ [sessionId]: {} })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            // With undefined tokens, the guard (|| Object.keys check) returns {}
            // All three matching instructions are "new" → message sent
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("returns empty object when session state has empty idempotencyTokens object", async () => {
            const sessionId = "sess-empty-tokens"
            SessionStorage.reset({ [sessionId]: { idempotencyTokens: {} } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            // With empty tokens object, the guard returns {} — all instructions are new
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })
    })

    describe("safePath guard prevents empty path from being excluded by matching token", () => {
        it("includes instruction when both path and description are empty strings but a matching token exists", async () => {
            // The token "instruction_load:" would match isAlreadyInjected("") if the guard didn't intercept
            SessionStorage.reset({ "sess-emptystr": { idempotencyTokens: { "instruction_load:": "ts" } } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: "" as any, description: "" as any, applyTo: "**/*.{ts}" }],
                loadBody: async () => "body",
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-emptystr", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            // The instruction is included because safePath is falsy and the guard returns true.
            // Without the guard (if (false)), isAlreadyInjected("") would match
            // the token "instruction_load:" and exclude the instruction.
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })

        it("includes instruction when safePath is undefined and a token would otherwise match", async () => {
            // Token with key "instruction_load:undefined" would match if guard were bypassed
            SessionStorage.reset({ "sess-undefpath": { idempotencyTokens: { "instruction_load:undefined": "ts" } } })

            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [{ path: undefined as any, description: undefined as any, applyTo: "**/*.{ts}" }],
                loadBody: async () => "body",
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-undefpath", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            // Guard returns true on undefined safePath; without it,
            // isAlreadyInjected(undefined) would match the token and exclude the instruction
            expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
        })
    })

    describe("slots remaining boundary (equivalent mutant)", () => {
        it("does not let slotsRemaining go below zero with reference-only instructions", async () => {
            SessionStorage.reset({ "sess-boundary-decr": { idempotencyTokens: {
                "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
                "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
                "instruction_load:/f5.ts:full": "ts",
            } } })

            // 5 full tokens → remainingSlots = 0
            // Next 3 instructions should ALL be reference-only (not just the first one)
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
                forFiles: async () => [
                    { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
                    { path: "/b.ts", description: "B", applyTo: "**/*.{ts}" },
                    { path: "/c.ts", description: "C", applyTo: "**/*.{ts}" },
                ],
                loadBody: async (p: string) => `Content of ${p}`,
            } as any)

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-boundary-decr", callID: "call-1" }, { args: { filePath: "/a.ts" } },
            )

            const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as Parameters<typeof sessionHelpers.sendMessage>[0]).message
            const injected = getInjectedDescriptions(message)
            // All 3 should be reference-only (no slots remaining)
            expect(injected.every(index => !index.hasContent)).toBe(true)
            // Verify the budget was not exceeded: no full-content blocks at all
            expect(message).not.toContain("<content>")
        })
    })

    describe("plugin ID string literal is used consistently", () => {
        it("uses the exact PLUGIN_ID string in the log callback prefix", async () => {
            vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(makeInstructions("/f.ts", "Test")))

            const plugin = await createPlugin(client)
            await (plugin?.["tool.execute.before"] ?? (() => Promise.resolve()))(
                { tool: "write", sessionID: "sess-plugid-str", callID: "call-1" }, { args: { filePath: "/f.ts" } },
            )

            // Invoke the log callback from createIndex with a known message
            const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
            ;(call.log as (message: string) => void)("mutant-test")

            // The PLUGIN_ID is interpolated into the log message.
            // If mutated to "", the message would be "[] mutant-test" — the regex catches this.
            expect(log).toHaveBeenCalledWith(
                expect.anything(),
                "info",
                expect.stringMatching(/^\[instructions-loader\] mutant-test$/),
            )
        })
    })
})
