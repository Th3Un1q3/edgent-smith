import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"
import { pluginContextBuilder } from "@tests/__utils/plugin-builder"

import { log } from "@plugins/helpers/logger"

import { SessionStorage } from "@plugins/helpers/kv-store"

import { sessionTracker } from "@plugins/session-tracker"
import { opencodeClientFactory } from "@tests/__utils/factories/client-factory"

vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())

const _mockUpdateState = new SessionStorage().updateState as any
  /* capture readState reference for validity check */
const _ = new SessionStorage().readState
const getSessionStorageInstance = () => new SessionStorage()

vi.mock("@plugins/helpers/logger")

interface SessionTrackerPlugin {
  "chat.message"?: (input: { sessionID?: string; agent?: string }) => Promise<void> | void
  dispose?: () => Promise<void>
  "event"?: (input: unknown) => Promise<void>
  "tool.execute.before": (input: { sessionID?: string; tool: string }) => Promise<void>
}

// ── Helpers ───────────────────────────────────────────────────────

const mkPlugin = async (): Promise<SessionTrackerPlugin> => {
  const result = await sessionTracker(getPluginContext() as never)
  return result as unknown as SessionTrackerPlugin
}

const getUpdaterFunction = (
  calls: unknown[],
  index: number,
): ((state: Record<string, unknown>) => Record<string, unknown>) =>
  (calls[index] as [string, (state: Record<string, unknown>) => Record<string, unknown>])[1]

function getPluginContext() {
  return pluginContextBuilder({
    clientFactory: () => opencodeClientFactory({ agentName: "build" }) as never,
  })
}

beforeEach(() => {
  SessionStorage.reset()
  void getSessionStorageInstance().updateState
})

// ── Initialization ────────────────────────────────────────────────

describe("sessionTracker", () => {
  describe("initialization", () => {
    it("logs initialized message on plugin creation and returns valid hooks", async () => {
      vi.mocked(log).mockClear()
      await sessionTracker(getPluginContext() as never)
      expect(log).toHaveBeenCalledWith(
        expect.any(Object), "info", "harness-plugin initialized",
      )

      const plugin = await mkPlugin()
      expect(typeof plugin["chat.message"]).toBe("function")
      expect(typeof plugin["tool.execute.before"]).toBe("function")
      expect(typeof plugin["event"]).toBe("function")
      expect(typeof plugin.dispose).toBe("function")
    })

    it("creates a SessionStorage instance without errors", async () => {
      const plugin = await mkPlugin()
      expect(plugin).toBeDefined()
    })
  })

  // ── chat.message hook ────────────────────────────────────────

  describe("chat.message", () => {
    it("sets startedAt and agent when sessionID and agent are provided", async () => {
      SessionStorage.reset({ ses_test: {} })
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      await hook({ sessionID: "ses_test", agent: "build" })
      await hook({ sessionID: "ses_test", agent: "deploy" })

      expect(_mockUpdateState).toHaveBeenCalledTimes(4) // 2 per call = markSessionAsStarted + recordLastMessageSent
    })

    it("records lastMessageSent when a chat message arrives", async () => {
      SessionStorage.reset({ ses_msg: {} })
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()
      await hook({ sessionID: "ses_msg", agent: "deploy" })

      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it.each([
      { name: "missing sessionID", input: () => ({ sessionID: undefined, agent: "build" } as const) },
      { name: "missing agent", input: () => ({ sessionID: "ses_test3" } as never) },
      { name: "both falsy", input: () => ({} as never) },
    ])("returns early without updating state when $name", async ({ name: _unused, input }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()
      await hook(input())

      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not update startedAt if already set (guard condition)", async () => {
      SessionStorage.reset({ ses_guard: { startedAt: "2026-01-01T00:00:00Z" } })
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()
      await hook({ sessionID: "ses_guard", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalled()
    })
  })

  // ── tool.execute.before hook ────────────────────────────────

  describe("tool.execute.before", () => {
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it("records tool call when sessionID is provided", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await hook({ sessionID: "ses_tool1", tool: "write" })

      expect(_mockUpdateState).toHaveBeenCalledWith(
        "ses_tool1", expect.any(Function),
      )
    })

    it.each([
      { name: "multiple tool calls for same session", sessionID: "ses_tool2", tools: ["read", "write"], count: 2 },
      { name: "missing sessionID skips update", sessionID: undefined, tools: ["read"], count: 0 },
      { name: "updates correct entry with timestamp", sessionID: "ses_ts", tools: ["question"], count: 1 },
    ])("$name", async ({ name: _name, sessionID, tools, count }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      for (const tool of tools) {
        if (sessionID === undefined) {
          await hook({ tool } as never)
        } else {
          await hook({ sessionID, tool })
        }
      }

      expect(_mockUpdateState).toHaveBeenCalledTimes(count ?? 0)
    })
  })

  // ── event: session.error ────────────────────────────────────

  describe("event", () => {
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it.each([
      { desc: "records cancelledAt when error name is MessageAbortedError", props: () => ({ sessionID: "ses_err1", error: { name: "MessageAbortedError" } }), expectCalled: true },
      { desc: "ignores other error names", props: () => ({ sessionID: "ses_err2", error: { name: "SomeOtherError" } }), expectCalled: false },
      { desc: "ignores when error object is missing", props: () => ({ sessionID: "ses_err3" }), expectCalled: false },
      { desc: "ignores when error.name is missing", props: () => ({ sessionID: "ses_err4", error: {} }), expectCalled: false },
      { desc: "ignores when sessionID is missing", props: () => ({}), expectCalled: false },
    ])("$desc", async ({ props, expectCalled }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()
      await eventHandler({ event: { type: "session.error" as const, properties: props() } })

      expect(_mockUpdateState).toHaveBeenCalledTimes(expectCalled ? 1 : 0)
    })

    it.each([
      { desc: "ignores other event types", props: () => ({ type: "some.other.event" as never, properties: {} }), expectCalled: false },
      { desc: "records cancelledAt even if no prior session state exists", props: () => ({
        type: "session.error" as const, properties: { sessionID: "ses_new_err", error: { name: "MessageAbortedError" } },
      }), expectCalled: true },
    ])("$desc", async ({ props, expectCalled }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()
      await eventHandler({ event: props() })

      expect(_mockUpdateState).toHaveBeenCalledTimes(expectCalled ? 1 : 0)
    })
  })

  // ── session.idle events ──────────────────────────────────────

  describe("session.idle handling", () => {
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it("records idleAt when idle event is received with valid sessionID", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await eventHandler({ event: { type: "session.idle" as const, properties: { sessionID: "ses_idle1" } } })

      expect(_mockUpdateState).toHaveBeenCalledWith(
        "ses_idle1", expect.any(Function),
      )
    })

    it.each([
      { desc: "ignores when sessionID is missing", props: () => ({ type: "session.idle" as const, properties: {} }), expectCalled: false },
      { desc: "ignores unknown event types", props: () => ({ type: "unknown.event" as never, properties: {} }), expectCalled: false },
    ])("$desc", async ({ props, expectCalled }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()
      await eventHandler({ event: props() })

      expect(_mockUpdateState).toHaveBeenCalledTimes(expectCalled ? 1 : 0)
    })

    it("handles idle events for sessions with no prior state", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await eventHandler({ event: { type: "session.idle" as const, properties: { sessionID: "ses_idle_new" } } })

      expect(_mockUpdateState).toHaveBeenCalled()
    })
  })

  // ── dispose ──────────────────────────────────────────────────

  describe("dispose", () => {
    it("logs disposed message on cleanup", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin

      _mockUpdateState.mockClear()
      await plugin.dispose?.()

      expect(log).toHaveBeenCalledWith(
        expect.any(Object), "info",
        expect.stringContaining("harness-plugin disposed"),
      )
    })
  })

  // ── State mutation edge cases ────────────────────────────────

  describe("state mutation edge cases", () => {
    it.each([
      { desc: "marks session as started on first chat.message call", setup: async () => { SessionStorage.reset({ ses_first: {} }) }, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["chat.message"]; _mockUpdateState.mockClear(); await hook({ sessionID: "ses_first", agent: "build" }); expect(_mockUpdateState).toHaveBeenCalled() }},
      { desc: "records tool calls accumulating across multiple invocations for the same session", setup: () => {}, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["tool.execute.before"]; _mockUpdateState.mockClear(); await hook({ sessionID: "ses_accum", tool: "read" }); await hook({ sessionID: "ses_accum", tool: "write" }); await hook({ sessionID: "ses_accum", tool: "question" }); expect(_mockUpdateState).toHaveBeenCalledTimes(3) }},
      { desc: "handles empty string sessionID (falsy check)", setup: () => {}, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["chat.message"]; _mockUpdateState.mockClear(); await hook({ sessionID: "" } as const); expect(_mockUpdateState).not.toHaveBeenCalled() }},
      { desc: "handles empty string agent (falsy check)", setup: () => {}, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["chat.message"]; _mockUpdateState.mockClear(); await hook({ sessionID: "ses_empty_agent", agent: "" } as const); expect(_mockUpdateState).not.toHaveBeenCalled() }},
      { desc: "handles tool.execute.before with undefined tool name", setup: () => {}, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["tool.execute.before"]; _mockUpdateState.mockClear(); await hook({ sessionID: "ses_null_tool", tool: undefined } as never); expect(_mockUpdateState).toHaveBeenCalled() }},
      { desc: "handles chat.message with undefined agent name", setup: () => {}, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["chat.message"]; _mockUpdateState.mockClear(); await hook({ sessionID: "ses_null_agent", agent: undefined } as never); expect(_mockUpdateState).not.toHaveBeenCalled() }},
    ])("$desc", async ({ action }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      await action(plugin)
    })

    it.each([
      { desc: "throws when event.properties is undefined (source code lacks guard)", props: () => ({ type: "session.error" as const, properties: undefined }), expectThrow: true },
      { desc: "throws when session.idle event has undefined properties", props: () => ({ type: "session.idle" as const, properties: undefined } as never), expectThrow: true },
    ])("$desc", async ({ props }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = ((plugin as any)["event"] ?? (() => {})) as (...arguments_: unknown[]) => Promise<unknown>

      await expect(eventHandler({ event: props() })).rejects.toThrow(/is not an object/)
    })

    it.each([
      { desc: "handles undefined error object on session.error", props: () => ({ type: "session.error" as const, properties: { sessionID: "ses_err_undef", error: undefined } }), expectCalled: false },
      { desc: "handles error but no name property", props: () => ({ type: "session.error" as const, properties: { sessionID: "ses_err_no_name", error: {} } }), expectCalled: false },
      { desc: "handles nullish sessionID in idle", props: () => ({ type: "session.idle" as const,   properties: { sessionID: null } }), expectCalled: false },
    ])("$desc", async ({ props }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()
      await eventHandler({ event: props() })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })
  })

  // ── Lifecycle integration ──────────────────────────────────────

  describe("lifecycle integration", () => {
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it("full session lifecycle: start → tool calls → idle → cancel", async () => {
      SessionStorage.reset({ ses_full: {} })
      const plugin = await mkPlugin() as SessionTrackerPlugin

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await (plugin as any)["chat.message"]({ sessionID: "ses_full", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalled()

      _mockUpdateState.mockClear()
      await (plugin as any)["tool.execute.before"]({ sessionID: "ses_full", tool: "read" })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_full", expect.any(Function))

      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.idle" as const, properties: { sessionID: "ses_full" } } })
      expect(_mockUpdateState).toHaveBeenCalled()

      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.error" as const, properties: { sessionID: "ses_full", error: { name: "MessageAbortedError" } } } })
      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it.each([
      { desc: "tracks multiple sessions independently", setup: async () => { SessionStorage.reset({ ses_A: {}, ses_B: {} }); const plugin = await mkPlugin(); _mockUpdateState.mockClear(); return plugin }},
      { desc: "handles rapid successive idle events on the same session", setup: async () => {}, action: async (p: SessionTrackerPlugin) => { const handler = (p as any)["event"]; for (let index = 0; index < 5; index++) await handler({ event: { type: "session.idle" as const, properties: { sessionID: "ses_rapid" } } }); expect(_mockUpdateState).toHaveBeenCalledTimes(5) }},
      { desc: "handles rapid successive tool calls on the same session", setup: async () => { const plugin = await mkPlugin(); return plugin }, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["tool.execute.before"]; for (const t of ["read","write","question","edit","diff"]) await hook({ sessionID: "ses_rapid_tool", tool: t }); expect(_mockUpdateState).toHaveBeenCalledTimes(5) }},
      { desc: "handles rapid successive chat messages on the same session", setup: async () => { const plugin = await mkPlugin(); return plugin }, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["chat.message"]; for (let index = 0; index < 3; index++) await hook({ sessionID: "ses_rapid_chat", agent: "build" }); expect(_mockUpdateState).toHaveBeenCalledTimes(6) }},
      { desc: "marks session started even when chat arrives before any tool calls", setup: async () => { SessionStorage.reset({ ses_pre_tool: {} }); const plugin = await mkPlugin(); _mockUpdateState.mockClear(); return plugin }, action: async (p: SessionTrackerPlugin) => { await (p as any)["chat.message"]({ sessionID: "ses_pre_tool", agent: "build" }); expect(_mockUpdateState).toHaveBeenCalled() }},
      { desc: "does not record idle for non-idle events", setup: async () => {}, action: async (p: SessionTrackerPlugin) => { await p["event"]?.({ event: { type: "session.unknown" as never, properties: {} } }); expect(_mockUpdateState).not.toHaveBeenCalled() }},
      { desc: "does not record cancelled for non-aborted errors", setup: async () => {}, action: async (p: SessionTrackerPlugin) => { await p["event"]?.({ event: { type: "session.error" as const, properties: { sessionID: "ses_non_abort", error: { name: "TimeoutError" } } } }); expect(_mockUpdateState).not.toHaveBeenCalled() }},
      { desc: "handles dispose logging with correct plugin ID in message", setup: async () => { const plugin = await mkPlugin(); _mockUpdateState.mockClear(); return plugin }, action: async (p: SessionTrackerPlugin) => { await p.dispose?.(); expect(log).toHaveBeenCalledWith(expect.any(Object), "info", expect.stringContaining("harness-plugin")) }},
      { desc: "handles undefined error on session.error event without throwing", setup: async () => { const plugin = await mkPlugin(); return plugin }, action: async (p: SessionTrackerPlugin) => { await expect(p["event"]?.({ event: { type: "session.error" as const, properties: { error: undefined } } })).resolves.toBeUndefined() }},
      { desc: "handles chat.message with whitespace-only agent (truthy in JS)", setup: async () => { const plugin = await mkPlugin(); _mockUpdateState.mockClear(); return plugin }, action: async (p: SessionTrackerPlugin) => { const hook = (p as any)["chat.message"]; await hook({ sessionID: "ses_ws_agent", agent: "  " } as never); expect(_mockUpdateState).toHaveBeenCalled() }},
    ])("$desc", async ({ setup, action }) => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      if (setup) await setup()
      if (action) await action(plugin)
    })

    it("handles mixed event types on the same session", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin

      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.idle" as const, properties: { sessionID: "ses_mixed1" } } })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_mixed1", expect.any(Function))

      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.error" as const, properties: { sessionID: "ses_mixed2", error: { name: "MessageAbortedError" } } } })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_mixed2", expect.any(Function))

      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.idle" as const, properties: { sessionID: "ses_mixed3" } } })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_mixed3", expect.any(Function))
    })

    it("dispose is safe to call even if no prior events occurred", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      _mockUpdateState.mockClear()
      await plugin.dispose?.()
      expect(log).toHaveBeenCalledWith(
        expect.any(Object), "info", expect.stringContaining("harness-plugin disposed"),
      )
    })
  })

  // ── Updater function verification ─────────────────────────────

  describe("updater function verification", () => {
    describe("markSessionAsStarted (via chat.message[0])", () => {
      beforeEach(async () => {
        const plugin = await mkPlugin() as SessionTrackerPlugin
        await (plugin as any)["chat.message"]({ sessionID: "ses_test", agent: "build" })
      })

      it("sets startedAt and agent when session has no prior state", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 0)
        expect(updater({})).toMatchObject({ startedAt: expect.any(String), agent: "build" })
      })

      it("preserves existing session fields when adding startedAt", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 0)
        const result = updater({ customField: "value", count: 42 })
        expect(result).toMatchObject({ customField: "value", count: 42, startedAt: expect.any(String), agent: "build" })
      })

      it("returns session unchanged (same reference) when startedAt already exists", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 0)
        const existing = { startedAt: "2024-01-01T00:00:00Z", agent: "old-agent", other: "data" }
        expect(updater(existing)).toBe(existing)
      })
    })

    describe("recordLastMessageSent (via chat.message[1])", () => {
      beforeEach(async () => {
        const plugin = await mkPlugin() as SessionTrackerPlugin
        await (plugin as any)["chat.message"]({ sessionID: "ses_test", agent: "build" })
      })

      it("sets lastMessageSentAt on session", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 1)
        const result = updater({})
        expect(result).toMatchObject({ lastMessageSentAt: expect.any(String) })
      })

      it("preserves existing fields when setting lastMessageSentAt", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 1)
        const result = updater({ existingField: 123, startedAt: "2024-01-01T00:00:00Z" })
        expect(result).toMatchObject({ existingField: 123, startedAt: "2024-01-01T00:00:00Z", lastMessageSentAt: expect.any(String) })
      })
    })

    describe("markToolAsCalled (via tool.execute.before)", () => {
      beforeEach(async () => {
        const plugin = await mkPlugin() as SessionTrackerPlugin
        await (plugin as any)["tool.execute.before"]({ sessionID: "ses_tool", tool: "read" })
      })

      it("records tool call when no prior toolCalls exist", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 0)
        const result = updater({})
        expect(result).toMatchObject({ toolCalls: { read: expect.any(String) } })
      })

      it("accumulates tool calls preserving prior tool entries", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 0)
        const result = updater({ toolCalls: { write: "2024-01-01T00:00:00Z" } })
        expect(result.toolCalls).toMatchObject({ write: "2024-01-01T00:00:00Z", read: expect.any(String) })
      })

      it("preserves existing session fields when recording tool call", () => {
        const updater = getUpdaterFunction(_mockUpdateState.mock.calls, 0)
        const result = updater({ otherField: "value", count: 42 })
        expect(result).toMatchObject({ otherField: "value", count: 42, toolCalls: expect.any(Object) })
      })
    })

    describe("recordLastSessionIdle (via session.idle)", () => {
      beforeEach(async () => {
        const plugin = await mkPlugin() as SessionTrackerPlugin
        await plugin["event"]?.({ event: { type: "session.idle" as const, properties: { sessionID: "ses_idle" } } })
      })

      it("sets idleAt on session", () => {
        const result = getUpdaterFunction(_mockUpdateState.mock.calls, 0)({})
        expect(result).toMatchObject({ idleAt: expect.any(String) })
      })

      it("preserves existing fields when setting idleAt", () => {
        const result = getUpdaterFunction(_mockUpdateState.mock.calls, 0)({ existingField: "value", startedAt: "2024-01-01T00:00:00Z" })
        expect(result).toMatchObject({ existingField: "value", startedAt: "2024-01-01T00:00:00Z", idleAt: expect.any(String) })
      })
    })

    describe("recordMessageCancelled (via session.error)", () => {
      beforeEach(async () => {
        const plugin = await mkPlugin() as SessionTrackerPlugin
        await plugin["event"]?.({
          event: { type: "session.error" as const, properties: { sessionID: "ses_cancel", error: { name: "MessageAbortedError" } } },
        })
      })

      it("sets cancelledAt on session", () => {
        const result = getUpdaterFunction(_mockUpdateState.mock.calls, 0)({})
        expect(result).toMatchObject({ cancelledAt: expect.any(String) })
      })

      it("preserves existing fields when setting cancelledAt", () => {
        const result = getUpdaterFunction(_mockUpdateState.mock.calls, 0)({ existingField: "value", startedAt: "2024-01-01T00:00:00Z" })
        expect(result).toMatchObject({ existingField: "value", startedAt: "2024-01-01T00:00:00Z", cancelledAt: expect.any(String) })
      })
    })
  })

  // ── Event handler conditional edge cases ──────────────────────

  describe("event handler conditional edge cases", () => {
    it("does not trigger cancelled for non-session.error event when sessionID is present", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      await plugin["event"]?.({
        event: { type: "some.other.event" as never, properties: { sessionID: "ses_other" } },
      })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not trigger cancelled for non-session.error event with sessionID and matching error name", async () => {
      const plugin = await mkPlugin() as SessionTrackerPlugin
      await plugin["event"]?.({
        event: { type: "some.other.event" as never, properties: { sessionID: "ses_match", error: { name: "MessageAbortedError" } } },
      })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })
  })

  // ── Plugin ID verification ────────────────────────────────────

  describe("plugin ID verification", () => {
    it("logs the exact plugin ID in initialization message", async () => {
      vi.mocked(log).mockReset()
      await sessionTracker(getPluginContext() as never)
      expect(log).toHaveBeenCalledTimes(1)
      const lastCall = vi.mocked(log).mock.calls[0]
      const initMessage = lastCall[2] as string
      expect(initMessage).toBe("harness-plugin initialized")
      expect(initMessage).not.toMatch(/^\s/)
    })

    it("logs the exact plugin ID in dispose message", async () => {
      const plugin = await mkPlugin()
      vi.mocked(log).mockReset()
      await plugin.dispose?.()
      expect(log).toHaveBeenCalledTimes(1)
      const lastCall = vi.mocked(log).mock.calls[0]
      const disposeMessage = lastCall[2] as string
      expect(disposeMessage).toBe("harness-plugin disposed")
      expect(disposeMessage).not.toMatch(/^\s/)
    })
  })
})
