import { beforeEach, describe, expect, it, vi } from "vitest"
import { defaultCreateClient, type ClientMock } from "@tests/helpers/mock-utilities"
import { makeKvStoreMockFactory, resetMockState } from "@tests/__utils/kv-store.mock"

vi.mock("@plugins/helpers/instruction-indexer", () => ({ createIndex: vi.fn() }))
vi.mock("@plugins/helpers/session-helpers")
vi.mock("@plugins/helpers/logger")
vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())

import { instructionsLoaderPlugin, type StateWithIdempotencyTokens } from "@plugins/instructions-loader"
import * as instructionIndexer from "@plugins/helpers/instruction-indexer"
import * as sessionHelpers from "@plugins/helpers/session-helpers"
import { log } from "@plugins/helpers/logger"
import { SessionStorage } from "@plugins/helpers/kv-store"

// ── Helpers ───────────────────────────────────────────────────────

const makeMockIndex = (instructions: any[]) => ({ forFiles: async () => instructions, loadBody: async (path: string) => `Content of ${path}` }) as any

async function createPlugin(client: ClientMock) {
  return await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
}

function getInjectedCount(message: string): number {
  return message.split("<instruction>").slice(1).filter(b => b.trim().length > 0).length
}

function getInjectedDescriptions(message: string): Array<{ desc: string; hasContent: boolean }> {
  return message.split("<instruction>").slice(1).map(block => ({ desc: block.match(/<description>(.*?)<\/description>/s)?.[1]?.trim() ?? "", hasContent: block.includes("<content>") }))
}

const mkInst = (path: string, desc: string) => [{ path, description: desc, applyTo: "**/*.{ts}" }]

async function runBudgetTest(
  sessionId: string, tokens: Record<string, string>, instructionCount: number,
): Promise<string> {
  const client = defaultCreateClient()
  resetMockState({ [sessionId]: { idempotencyTokens: tokens } })
  vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
    forFiles: async () => Array.from({ length: instructionCount }, (_, index) => ({
      path: `/${String.fromCodePoint(65 + index)}.ts`,
      description: `Inst ${String.fromCodePoint(65 + index)}`, applyTo: "**/*.{ts}" })),
    loadBody: async (p: string) => `Content of ${p}`,
  } as any)
  const p = await instructionsLoaderPlugin({ client, directory: "/workspace" } as never)
  const h = p?.["tool.execute.before"] ?? (() => Promise.resolve())
  await h({ tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/a.ts" } })
  expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
  return (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
}

// ── Suite ─────────────────────────────────────────────────────────

describe("instructionsLoaderPlugin", () => {
  let client: ClientMock

  beforeEach(() => {
    vi.clearAllMocks()
    resetMockState()
    client = defaultCreateClient()
  })

  describe("tool targeting", () => {
    it.each([{ t: "write" }, { t: "edit" }, { t: "read" }])("sends instructions for '$t' tool", async ({ t }) => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: t, sessionID: "sess-1", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })

    it("skips non-targeted tools", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "ls", sessionID: "sess-1", callID: "call-ls" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
    })
  })

  describe("early return", () => {
    it.each([
      { name: "missing sessionID", input: { tool: "write", callID: "call-1" }, args: { args: { filePath: "/f.ts" } } },
      { name: "missing filePath in args", input: { tool: "write", sessionID: "sess-1", callID: "call-1" }, args: {} },
    ])("skips when $name", async ({ input, args }) => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await ((p?.["tool.execute.before"] ?? (() => Promise.resolve()))(input as never, args as never))
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
    })

    it("returns early when no file paths match the index", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([]))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-1", callID: "call-1" }, { args: { filePath: "/unknown.ts" } },
      )
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
      expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining("No new instructions to send for session"), expect.any(String))
    })
  })

  describe("agent-specific index caching", () => {
    it("defaults to 'build' agent when session has no agent field", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-no-agent", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledWith(expect.objectContaining({ agent: "build" }))
    })

    it("defaults to 'build' agent when session.get returns null/undefined", async () => {
      vi.mocked(client.session.get).mockResolvedValue(undefined as unknown as { data?: Record<string, unknown> })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await expect(
        (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
          { tool: "write", sessionID: "sess-null", callID: "call-1" }, { args: { filePath: "/f.ts" } },
        ),
      ).resolves.not.toThrow()
      expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledWith(expect.objectContaining({ agent: "build" }))
    })

    it("reuses cached index for same default agent across sessions", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      const h = p?.["tool.execute.before"] ?? (() => Promise.resolve())
      await h({ tool: "write", sessionID: "sess-a", callID: "call-1" }, { args: { filePath: "/f.ts" } })
      await h({ tool: "write", sessionID: "sess-b", callID: "call-2" }, { args: { filePath: "/f.ts" } })
      expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(1)
    })

    it("creates separate index when session agent differs from default", async () => {
      const copilotClient = defaultCreateClient()
      vi.spyOn(copilotClient.session, "get").mockImplementation(async (_path: unknown) => {
        if ((_path as { path?: { id?: string } })?.path?.id === "sess-copilot") return { data: { agent: "copilot" } }
        return { data: {} }
      })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(copilotClient)
      const h = p?.["tool.execute.before"] ?? (() => Promise.resolve())
      await h({ tool: "write", sessionID: "sess-build", callID: "call-1" }, { args: { filePath: "/f.ts" } })
      await h({ tool: "write", sessionID: "sess-copilot", callID: "call-2" }, { args: { filePath: "/f.ts" } })
      expect(vi.mocked(instructionIndexer.createIndex)).toHaveBeenCalledTimes(2)
    })

    it("never creates more indexes than unique agents", async () => {
      const agents = new Set<string>()
      vi.mocked(instructionIndexer.createIndex).mockImplementation(async (options) => { agents.add(options.agent); return makeMockIndex([]) })
      for (const agent of ["build", "copilot", "designer", "copilot", "build"]) {
        const c = defaultCreateClient()
        vi.spyOn(c.session, "get").mockResolvedValue({ data: { agent } })
        const p = await createPlugin(c)
        await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
          { tool: "write", sessionID: `sess-${agent}`, callID: `call-${agent}` }, { args: { filePath: "/f.ts" } },
        )
      }
      expect(agents.size).toBe(3)
    })
  })

  describe("createIndex call arguments", () => {
    it("passes correct instructionsGlob and type", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-a", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
      expect(call.instructionsGlob).toBe(".opencode/instructions/*.instructions.md")
      expect(call.type).toBe("custom")
    })

    it("passes a log function to createIndex that invokes the logger", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-log", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
      expect(call.log).toBeInstanceOf(Function)
      ;(call.log as (message: string) => void)("index build")
      expect(log).toHaveBeenCalledWith(expect.any(Object), "info", "index build", expect.any(String))
    })
  })

  describe("idempotency", () => {
    it.each([
      { name: "unsuffixed token", key: "instruction_load:/a.ts" },
      { name: ":full suffixed token", key: "instruction_load:/a.ts:full" },
      { name: ":ref suffixed token", key: "instruction_load:/a.ts:ref" },
    ])("skips instruction when $name exists", async ({ key }) => {
      resetMockState({ "sess-idem": { idempotencyTokens: { [key]: "ts" } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/a.ts", "A")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-idem", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      expect(sessionHelpers.sendMessage).not.toHaveBeenCalled()
    })

    it("does NOT skip when token has non-standard suffix (:other)", async () => {
      resetMockState({ "sess-other": { idempotencyTokens: { "instruction_load:/a.ts:other": "ts" } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/a.ts", "A")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-other", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })

    it("sends only new instructions when some were previously sent", async () => {
      resetMockState({ "sess-mixed": { idempotencyTokens: { "instruction_load:/old.ts": "ts" } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([
        { path: "/old.ts", description: "Old", applyTo: "**/*.{ts}" },
        { path: "/new.ts", description: "New", applyTo: "**/*.{ts}" },
      ]))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-mixed", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain("<description>New</description>")
      expect(message).not.toContain("<description>Old</description>")
    })

    it("updates sessionStorage with new tokens after sending", async () => {
      const sessionId = "sess-upd"
      resetMockState({ [sessionId]: { idempotencyTokens: { "instruction_load:/old.ts": "ts" } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/new.ts", "New")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/new.ts" } },
      )
      const tokens = (new SessionStorage()).readState<StateWithIdempotencyTokens, Record<string, string>>(
        sessionId, s => s.idempotencyTokens ?? {},
      )
      expect(tokens).toHaveProperty("instruction_load:/old.ts")
      expect(tokens).toHaveProperty("instruction_load:/new.ts:full")
      expect(Object.keys(tokens ?? {}).length).toBe(2)
    })

    it.each([
      { name: "undefined idempotencyTokens", state: {} },
      { name: "empty idempotencyTokens", state: { idempotencyTokens: {} } },
    ])("handles $name gracefully and sends instructions", async ({ state }) => {
      resetMockState({ "sess-edge": state })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-edge", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
  })

  describe("session-aware 5-slot budget", () => {
    it("injects 6 instructions in empty session", async () => {
      expect(getInjectedCount(await runBudgetTest("sess-empty", {}, 6))).toBe(6)
    })

    it("injects full content when fewer than 5 :full tokens exist", async () => {
      const message = await runBudgetTest("sess-partial", {
        "instruction_load:/p1.ts:full": "ts", "instruction_load:/p2.ts:ref": "ts",
      }, 2)
      expect(getInjectedDescriptions(message).every(index => index.hasContent)).toBe(true)
    })

    it("injects as reference-only when 5 :full tokens already present", async () => {
      const message = await runBudgetTest("sess-full", {
        "instruction_load:/p1.ts:full": "ts", "instruction_load:/p2.ts:full": "ts",
        "instruction_load:/p3.ts:full": "ts", "instruction_load:/p4.ts:full": "ts",
        "instruction_load:/p5.ts:full": "ts",
      }, 2)
      const injected = getInjectedDescriptions(message)
      expect(injected.every(index => !index.hasContent)).toBe(true)
      expect(injected.length).toBe(2)
    })

    it("distributes full vs reference at exact boundary (4 full → 1 slot left)", async () => {
      resetMockState({ "sess-bound2": { idempotencyTokens: {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [
          { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
          { path: "/b.ts", description: "B", applyTo: "**/*.{ts}" },
        ],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-bound2", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      const injected = getInjectedDescriptions((vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message)
      expect(injected[0].hasContent).toBe(true)
      expect(injected[1].hasContent).toBe(false)
    })

    it.each([
      { name: "legacy unsuffixed", tokens: { "instruction_load:/p1.ts": "ts", "instruction_load:/p2.ts": "ts" }, instCount: 5 },
      { name: ":ref suffixed", tokens: { "instruction_load:/x.ts:ref": "ts", "instruction_load:/y.ts": "ts" }, instCount: 1 },
    ])("does not count $name tokens toward budget", async ({ tokens, instCount }) => {
      resetMockState({ "sess-legacy": { idempotencyTokens: tokens } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => Array.from({ length: instCount }, (_, index) => ({
          path: `/${String.fromCodePoint(65 + index)}.ts`, description: `Inst ${index}`, applyTo: "**/*.{ts}" })),
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-legacy", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(getInjectedCount(message)).toBe(instCount)
      expect(message).toContain("<content>")
    })

    it("exactly hits the cap boundary at slot 5 with mixed ref/full tokens", async () => {
      resetMockState({ "sess-boundary": { idempotencyTokens: {
        "instruction_load:/p1.ts:full": "ts", "instruction_load:/p2.ts:ref": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => ["/a", "/b", "/c"].map(path => ({ path, description: `Inst ${path}`, applyTo: "**/*.{ts}" })),
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-boundary", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      expect(getInjectedCount((vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message)).toBe(3)
    })

    it("session survives restart with pre-populated state", async () => {
      const sessionId = "sess-survive"
      resetMockState({ [sessionId]: { idempotencyTokens: {
        "instruction_load:/p1.ts:full": "ts", "instruction_load:/p2.ts:full": "ts",
        "instruction_load:/p3.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/a.ts", description: "A", applyTo: "**/*.{ts}" }],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p1 = await createPlugin(client)
      await (p1?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: sessionId, callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
      vi.mocked(sessionHelpers.sendMessage).mockClear()
      resetMockState({ [sessionId]: { idempotencyTokens: {
        "instruction_load:/p1.ts:full": "ts", "instruction_load:/p2.ts:full": "ts",
        "instruction_load:/p3.ts:full": "ts", "instruction_load:/a.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/b.ts", description: "B", applyTo: "**/*.{ts}" }],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p2 = await createPlugin(client)
      await (p2?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: sessionId, callID: "call-2" }, { args: { filePath: "/b.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })

    it("new session starts fresh", async () => {
      resetMockState({ "sess-new": {} })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/a.ts", description: "A", applyTo: "**/*.{ts}" }],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-new", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })

    it("counts only :full suffixed tokens toward budget", async () => {
      const message = await runBudgetTest("sess-suf", {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/u1.ts": "ts", "instruction_load:/r1.ts:ref": "ts",
      }, 4)
      expect(getInjectedDescriptions(message).filter(index => index.hasContent).length).toBe(3)
    })

    it("does not decrement slotsRemaining once isReference is already true and never goes below zero", async () => {
      resetMockState({ "sess-decr": { idempotencyTokens: {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
        "instruction_load:/f5.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [
          { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
          { path: "/b.ts", description: "B", applyTo: "**/*.{ts}" },
          { path: "/c.ts", description: "C", applyTo: "**/*.{ts}" },
        ],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-decr", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(getInjectedDescriptions(message).every(index => !index.hasContent)).toBe(true)
      expect(message).not.toContain("<content>")
    })
  })

  describe("safePath guard", () => {
    it.each([
      { name: "empty string path and description", path: "", desc: "", tokenKey: "instruction_load:" },
      { name: "undefined path and description", path: undefined, desc: undefined, tokenKey: "instruction_load:undefined" },
    ])("includes instruction when safePath is $name", async ({ path, desc, tokenKey }) => {
      resetMockState({ "sess-safe": { idempotencyTokens: { [tokenKey]: "ts" } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path, description: desc, applyTo: "**/*.{ts}" }],
        loadBody: async () => "body",
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-safe", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })

    it("still sends when both path and description are falsy (no matching token)", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: undefined as unknown as string, description: undefined as unknown as string, applyTo: "**/*.{ts}" }],
        loadBody: async () => "body",
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-nopath", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledOnce()
    })
  })

  describe("steering message and XML format", () => {
    it("wraps instructions in a steering element with priority, reason, type", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-steer", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain('<steering priority="high" reason="relevant files touched" type="instructions">')
      expect(message).toContain("</steering>")
      expect(message).toMatch(/<steering\s+[^>]*priority="high"/)
    })

    it("renders full instruction block with all XML tags and content", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test Desc")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-xml-full", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain("<instruction>")
      expect(message).toContain("</instruction>")
      expect(message).toContain("<description>Test Desc</description>")
      expect(message).toContain("<path>/f.ts</path>")
      expect(message).toContain("<content>")
      expect(message).toContain("</content>")
      expect(message).toContain("Content of /f.ts")
      expect(message).not.toContain("<meta")
    })

    it("renders empty content element when instruction body is undefined", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/e.ts", description: "Empty", applyTo: "**/*.{ts}" }],
        loadBody: async () => undefined as unknown as string,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-empty-body", callID: "call-1" }, { args: { filePath: "/e.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain("<content>")
      expect(message).toContain("</content>")
      expect(message).not.toContain("Content of /e.ts")
      const contentMatch = message.match(/<content>\n(.*?)\n  <\/content>/s)
      expect(contentMatch).not.toBeNull()
      expect(contentMatch?.[1]?.trim()).toBe("")
    })

    it("renders reference-only block with <meta/> instead of <content>", async () => {
      resetMockState({ "sess-xml-ref": { idempotencyTokens: {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
        "instruction_load:/f5.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/r.ts", description: "Ref Desc", applyTo: "**/*.{ts}" }],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-xml-ref", callID: "call-1" }, { args: { filePath: "/r.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain("<instruction>")
      expect(message).toContain("</instruction>")
      expect(message).toContain("<description>Ref Desc</description>")
      expect(message).toContain("<path>/r.ts</path>")
      expect(message).toContain("<meta")
      expect(message).toContain("/>")
      expect(message).not.toContain("<content>")
    })

    it.each([
      { name: "includes lines/chars when content exists", path: "/m.ts", desc: "Meta", body: "line1\nline2", assertHas: (m: string) => { expect(m).toContain('lines="2"'); expect(m).toContain('chars="11"') } },
      { name: "omits lines/chars when content is falsy", path: "/e.ts", desc: "Empty Meta", body: undefined, assertHas: (m: string) => { expect(m).toContain("<meta/>"); expect(m).not.toContain("lines="); expect(m).not.toContain("chars=") } },
    ])("$name", async ({ path, desc, body, assertHas }) => {
      resetMockState({ "sess-meta": { idempotencyTokens: {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
        "instruction_load:/f5.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path, description: desc, applyTo: "**/*.{ts}" }],
        loadBody: async () => body as unknown as string,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-meta", callID: "call-1" }, { args: { filePath: path } },
      )
      assertHas((vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message)
    })

    it("uses double newlines between blocks and single newlines within blocks", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [
          { path: "/a.ts", description: "A", applyTo: "**/*.{ts}" },
          { path: "/b.ts", description: "B", applyTo: "**/*.{ts}" },
        ],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-sep", callID: "call-1" }, { args: { filePath: "/a.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain("</instruction>\n\n<instruction>")
      expect(message).toMatch(/  <description>.*<\/description>\n  <path>.*<\/path>\n  <content>/)
    })

    it("uses newline separators between XML elements in reference blocks", async () => {
      resetMockState({ "sess-ref-nl": { idempotencyTokens: {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
        "instruction_load:/f5.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/r.ts", description: "Ref", applyTo: "**/*.{ts}" }],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-ref-nl", callID: "call-1" }, { args: { filePath: "/r.ts" } },
      )
      const message = (vi.mocked(sessionHelpers.sendMessage).mock.calls[0][0] as any).message
      expect(message).toContain("<description>Ref</description>\n  <path>")
      expect(message).toContain("</path>\n  <meta")
      expect(message).toContain("/>\n</instruction>")
    })
  })

  describe("sendMessage and token recording", () => {
    it("calls sendMessage with noReply: true", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-noreply", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      expect(sessionHelpers.sendMessage).toHaveBeenCalledWith(expect.objectContaining({ noReply: true }))
    })

    it("records :full suffix tokens for full instructions", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-tok-full", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      const tokens = (new SessionStorage()).readState<{ idempotencyTokens?: Record<string, string> }, Record<string, string>>(
        "sess-tok-full", s => s.idempotencyTokens ?? {},
      )
      expect(Object.keys(tokens ?? {}).some(k => k.endsWith(":full"))).toBe(true)
    })

    it("records :ref suffix tokens for reference instructions", async () => {
      resetMockState({ "sess-tok-ref": { idempotencyTokens: {
        "instruction_load:/f1.ts:full": "ts", "instruction_load:/f2.ts:full": "ts",
        "instruction_load:/f3.ts:full": "ts", "instruction_load:/f4.ts:full": "ts",
        "instruction_load:/f5.ts:full": "ts",
      } } })
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue({
        forFiles: async () => [{ path: "/new.ts", description: "New", applyTo: "**/*.{ts}" }],
        loadBody: async (p: string) => `Content of ${p}`,
      } as any)
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-tok-ref", callID: "call-1" }, { args: { filePath: "/new.ts" } },
      )
      const tokens = (new SessionStorage()).readState<{ idempotencyTokens?: Record<string, string> }, Record<string, string>>(
        "sess-tok-ref", s => s.idempotencyTokens ?? {},
      )
      const newKeys = Object.keys(tokens ?? {}).filter(k => k.startsWith("instruction_load:/new.ts"))
      expect(newKeys.length).toBe(1)
      expect(newKeys[0]).toContain(":ref")
    })
  })

  describe("plugin ID in log messages", () => {
    it("uses 'instructions-loader' as pluginId in no-new-instructions log", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex([]))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-plugid", callID: "call-1" }, { args: { filePath: "/no-match.ts" } },
      )
      const logCalls = vi.mocked(log).mock.calls
      const noNew = logCalls.find(c => typeof c[2] === "string" && (c[2] as string).includes("No new instructions to send"))
      expect(noNew).toBeDefined()
      expect((noNew as typeof logCalls[number])[3]).toBe("instructions-loader")
      // Verify via built-in matcher as a second path to kill StringLiteral mutant on PLUGIN_ID
      expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining("No new instructions"), "instructions-loader")
    })

    it("uses the exact PLUGIN_ID in the createIndex log callback prefix", async () => {
      vi.mocked(instructionIndexer.createIndex).mockResolvedValue(makeMockIndex(mkInst("/f.ts", "Test")))
      const p = await createPlugin(client)
      await (p?.["tool.execute.before"] ?? (() => Promise.resolve()))(
        { tool: "write", sessionID: "sess-log-id", callID: "call-1" }, { args: { filePath: "/f.ts" } },
      )
      const call = vi.mocked(instructionIndexer.createIndex).mock.calls[0][0]
      ;(call.log as (m: string) => void)("test")
      expect(log).toHaveBeenCalledTimes(1)
      expect(vi.mocked(log).mock.calls[0][3]).toBe("instructions-loader")
    })
  })
})
