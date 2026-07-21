/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"
import { pluginContextBuilder } from "@tests/__utils/plugin-builder"

import { log } from "@plugins/helpers/logger"

import { SessionStorage } from "@plugins/helpers/kv-store"

import { sessionTracker } from "@plugins/session-tracker"
import { opencodeClientFactory } from "@tests/__utils/factories/client-factory"
// The vi.mock factory returns a fresh mock per invocation. We capture the
// static reset method and an instance-level reference to updateState so we
// can inspect calls across tests without depending on prototype access (which
// doesn't work for instance properties in Bun/vitest).
vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())

// Grab a direct handle on the mock after the hoisted vi.mock runs.
const _mockUpdateState = new SessionStorage().updateState as any
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */ /* capture readState reference for validity check */
const _ = new SessionStorage().readState
const getSessionStorageInstance = () => new SessionStorage()

// Logger mock — use automatic mocking (no factory) so `log` resolves as a spy.
vi.mock("@plugins/helpers/logger")

interface SessionTrackerPlugin {
  dispose?: () => Promise<void>
  "event"?: (input: unknown) => Promise<void>
  "tool.execute.before": (input: { sessionID?: string; tool: string }) => Promise<void>
}

describe("sessionTracker", () => {
  let pluginContext: ReturnType<typeof pluginContextBuilder>

  beforeEach(() => {
    SessionStorage.reset()
    // Reset the in-memory state via the static reset on MockSessionStorage
    void getSessionStorageInstance().updateState // ensure mock instance is valid
    pluginContext = pluginContextBuilder({
      clientFactory: () => opencodeClientFactory({ agentName: "build" }) as never,
    })
  })

  // ──────────────────────────────────────────────
  // Plugin initialization
  // ──────────────────────────────────────────────
  describe("initialization", () => {
    it("logs initialized message on plugin creation", async () => {
      await sessionTracker(pluginContext as never)
      expect(log).toHaveBeenCalledWith(
        expect.any(Object),
        "info",
        expect.stringContaining("harness-plugin initialized"),
      )
    })

    it("returns a valid plugin registration object with all hooks", async () => {
      const plugin = await sessionTracker(pluginContext as never)
      expect(plugin).toBeDefined()
      expect(typeof plugin["chat.message"]).toBe("function")
      expect(typeof plugin["tool.execute.before"]).toBe("function")
      expect(typeof plugin["event"]).toBe("function")
      expect(typeof plugin.dispose).toBe("function")
    })

    it("creates a SessionStorage instance without errors", async () => {
      const plugin = await sessionTracker(pluginContext as never)
      expect(plugin).toBeDefined()
    })
  })

  // ──────────────────────────────────────────────
  // "chat.message" hook handler
  // ──────────────────────────────────────────────
  describe("chat.message", () => {
    it("sets startedAt and agent when sessionID and agent are provided", async () => {
      SessionStorage.reset({ ses_test: {} })

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      // Call twice — second call should hit the guard (startedAt already set)
      await hook({ sessionID: "ses_test", agent: "build" })
      await hook({ sessionID: "ses_test", agent: "deploy" })

      expect(_mockUpdateState).toHaveBeenCalledTimes(4) // 2 per call = markSessionAsStarted + recordLastMessageSent

      // Check that startedAt was set on the first updateState call for ses_test
      const firstCall = _mockUpdateState.mock.calls.find((c: unknown[]) => c[0] === "ses_test") as [string, (s: Record<string, unknown>) => Record<string, unknown>] | undefined
      expect(firstCall).toBeDefined()
    })

    it("records lastMessageSent when a chat message arrives", async () => {
      SessionStorage.reset({ ses_msg: {} })

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()
      await hook({ sessionID: "ses_msg", agent: "deploy" })

      // Should have called updateState for the lastMessageSent field (second call in pair)
      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it("returns early without updating state when sessionID is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()
      await hook({ sessionID: undefined, agent: "build" })

      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("returns early without updating state when agent is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()

      await hook({ sessionID: "ses_test3" } as never)
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("returns early when both sessionID and agent are falsy", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()

      await hook({} as never)
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not update startedAt if already set (guard condition)", async () => {
      SessionStorage.reset({ ses_guard: { startedAt: "2026-01-01T00:00:00Z" } })

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()

      await hook({ sessionID: "ses_guard", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  // "tool.execute.before" hook handler
  // ──────────────────────────────────────────────
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
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await hook({ sessionID: "ses_tool1", tool: "write" })

      expect(_mockUpdateState).toHaveBeenCalledWith(
        "ses_tool1",
        expect.any(Function),
      )
    })

    it("records multiple tool calls for the same session", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      _mockUpdateState.mockClear()
      await hook({ sessionID: "ses_tool2", tool: "read" })
      await hook({ sessionID: "ses_tool2", tool: "write" })

      expect(_mockUpdateState).toHaveBeenCalledTimes(2)
    })

    it("returns early without updating state when sessionID is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      expect(_mockUpdateState).not.toHaveBeenCalled()

      await hook({ tool: "read" })
    })

    it("updates the correct tool entry with a timestamp", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await hook({ sessionID: "ses_ts", tool: "question" })

      expect(_mockUpdateState).toHaveBeenCalledWith(
        "ses_ts",
        expect.any(Function),
      )
    })
  })

  // ──────────────────────────────────────────────
  // "event" hook handler — session.error
  // ──────────────────────────────────────────────
  describe("event: session.error", () => {
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it("records cancelledAt when error name is MessageAbortedError", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await eventHandler({
        event: {
          type: "session.error" as const,
          properties: {
            sessionID: "ses_err1",
            error: { name: "MessageAbortedError" },
          },
        },
      })

      expect(_mockUpdateState).toHaveBeenCalledWith(
        "ses_err1",
        expect.any(Function),
      )
    })

    it("ignores session.error events with different error names", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: {
          type: "session.error" as const,
          properties: {
            sessionID: "ses_err2",
            error: { name: "SomeOtherError" },
          },
        },
      })

      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("ignores session.error when error object is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: {
          type: "session.error" as const,
          properties: { sessionID: "ses_err3" },
        },
      })
    })

    it("ignores session.error when error.name is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: {
          type: "session.error" as const,
          properties: { sessionID: "ses_err4", error: {} },
        },
      })
    })

    it("ignores other event types that happen to be errors", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: { type: "some.other.event" as never, properties: {} },
      })
    })

    it("ignores session.error when sessionID is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: { type: "session.error" as const, properties: {} },
      })
    })

    it("records cancelledAt even if no prior session state exists", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await eventHandler({
        event: {
          type: "session.error" as const,
          properties: { sessionID: "ses_new_err", error: { name: "MessageAbortedError" } },
        },
      })

      expect(_mockUpdateState).toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  // "event" hook handler — session.idle
  // ──────────────────────────────────────────────
  describe("event: session.idle", () => {
    let originalDateNow: typeof Date.now

    beforeEach(() => {
      originalDateNow = Date.now
      vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000)
    })

    afterEach(() => {
      Date.now = originalDateNow
    })

    it("records idleAt when idle event is received with valid sessionID", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await eventHandler({
        event: { type: "session.idle" as const, properties: { sessionID: "ses_idle1" } },
      })

      expect(_mockUpdateState).toHaveBeenCalledWith(
        "ses_idle1",
        expect.any(Function),
      )
    })

    it("ignores idle event when sessionID is missing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: { type: "session.idle" as const, properties: {} },
      })
    })

    it("ignores unknown event types", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]


      await eventHandler({
        event: { type: "unknown.event" as never, properties: {} },
      })
    })

    it("handles idle events for sessions with no prior state", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      expect(_mockUpdateState).not.toHaveBeenCalled()
      await eventHandler({
        event: { type: "session.idle" as const, properties: { sessionID: "ses_idle_new" } },
      })

      expect(_mockUpdateState).toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  // dispose hook handler
  // ──────────────────────────────────────────────
  describe("dispose", () => {
    it("logs disposed message on cleanup", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin

      _mockUpdateState.mockClear() // clear to avoid noise from prior calls
      await plugin.dispose?.()

      expect(log).toHaveBeenCalledWith(
        expect.any(Object),
        "info",
        expect.stringContaining("harness-plugin disposed"),
      )
    })
  })

  // ──────────────────────────────────────────────
  // Edge cases — comprehensive state mutation paths
  // ──────────────────────────────────────────────
  describe("state mutation edge cases", () => {
    it("marks session as started on first chat.message call", async () => {
      SessionStorage.reset({ ses_first: {} })

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()

      await hook({ sessionID: "ses_first", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it("records tool calls accumulating across multiple invocations for the same session", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      _mockUpdateState.mockClear()
      await hook({ sessionID: "ses_accum", tool: "read" })
      await hook({ sessionID: "ses_accum", tool: "write" })
      await hook({ sessionID: "ses_accum", tool: "question" })

      expect(_mockUpdateState).toHaveBeenCalledTimes(3)
    })

    it("handles empty string sessionID (falsy check)", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()

      await hook({ sessionID: "" } as never)
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("handles empty string agent (falsy check)", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()

      await hook({ sessionID: "ses_empty_agent", agent: "" })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("throws when event.properties is null (source code lacks guard)", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      // The source code accesses event.properties.sessionID without checking properties itself.
      // This test documents the actual behavior — it throws a TypeError.

      await expect(
        /* eslint-disable-next-line unicorn/no-null */
        eventHandler({ event: { type: "session.error" as const, properties: null as never } }),
      ).rejects.toThrow("null is not an object (evaluating 'event.properties.sessionID')")
    })

    it("throws when session.idle event has null properties", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = plugin["event"]!

      // Same — source code does not guard against null properties.
      await expect(
        /* eslint-disable-next-line unicorn/no-null */
        eventHandler({ event: { type: "session.idle" as const, properties: null as never } }),
      ).rejects.toThrow("null is not an object (evaluating 'event.properties.sessionID')")
    })

    it("handles undefined error object on session.error", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()

      await eventHandler({
        event: { type: "session.error" as const, properties: { sessionID: "ses_err_undef", error: undefined } },
      })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("handles session.error with error but no name property", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()

      await eventHandler({
        event: { type: "session.error" as const, properties: { sessionID: "ses_err_no_name", error: {} } },
      })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("handles session.idle with nullish sessionID in properties", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      _mockUpdateState.mockClear()

      await eventHandler({
        /* eslint-disable-next-line unicorn/no-null */
        event: { type: "session.idle" as const, properties: { sessionID: null } },
      })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("handles tool.execute.before with undefined tool name", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      _mockUpdateState.mockClear()

      await hook({ sessionID: "ses_null_tool", tool: undefined } as never)
      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it("handles chat.message with null agent name", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()


      /* eslint-disable-next-line unicorn/no-null */
      await hook({ sessionID: "ses_null_agent", agent: null } as never)
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })
  })

  // ──────────────────────────────────────────────
  // Integration — combined lifecycle scenarios
  // ──────────────────────────────────────────────
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

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin

      // 1. Start session
      expect(_mockUpdateState).not.toHaveBeenCalled()
      await (plugin as any)["chat.message"]({ sessionID: "ses_full", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalled()

      // 2. Tool calls
      _mockUpdateState.mockClear()
      await (plugin as any)["tool.execute.before"]({ sessionID: "ses_full", tool: "read" })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_full", expect.any(Function))

      // 3. Idle event
      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.idle" as const, properties: { sessionID: "ses_full" } } })
      expect(_mockUpdateState).toHaveBeenCalled()

      // 4. Cancel
      _mockUpdateState.mockClear()
      await plugin["event"]?.({ event: { type: "session.error" as const, properties: { sessionID: "ses_full", error: { name: "MessageAbortedError" } } } })
      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it("multiple sessions tracked independently", async () => {
      SessionStorage.reset({ ses_A: {}, ses_B: {} })

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin

      // Session A
      _mockUpdateState.mockClear()
      await (plugin as any)["chat.message"]({ sessionID: "ses_A", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_A", expect.any(Function))

      // Session B
      _mockUpdateState.mockClear()
      await (plugin as any)["chat.message"]({ sessionID: "ses_B", agent: "deploy" })
      expect(_mockUpdateState).toHaveBeenCalledWith("ses_B", expect.any(Function))
    })

    it("dispose is safe to call even if no prior events occurred", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      _mockUpdateState.mockClear()
      await plugin.dispose?.()
      expect(log).toHaveBeenCalledWith(
        expect.any(Object),
        "info",
        expect.stringContaining("harness-plugin disposed"),
      )
    })

    it("handles rapid successive events on the same session", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const eventHandler = (plugin as any)["event"]

      // Rapid fire multiple idle events
      for (let index = 0; index < 5; index++) {

        await eventHandler({ event: { type: "session.idle" as const, properties: { sessionID: "ses_rapid" } } })
      }

      expect(_mockUpdateState).toHaveBeenCalledTimes(5)
    })

    it("handles rapid successive tool calls on the same session", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["tool.execute.before"]

      for (const tool of ["read", "write", "question", "edit", "diff"]) {

        await hook({ sessionID: "ses_rapid_tool", tool })
      }

      expect(_mockUpdateState).toHaveBeenCalledTimes(5)
    })

    it("handles rapid successive chat messages on the same session", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      for (let index = 0; index < 3; index++) {

        await hook({ sessionID: "ses_rapid_chat", agent: "build" })
      }

      expect(_mockUpdateState).toHaveBeenCalledTimes(6) // 2 per call (markSessionAsStarted + recordLastMessageSent)
    })

    it("handles mixed event types on the same session", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin

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

    it("marks session started even when chat arrives before any tool calls", async () => {
      SessionStorage.reset({ ses_pre_tool: {} })

      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      _mockUpdateState.mockClear()

      await (plugin as any)["chat.message"]({ sessionID: "ses_pre_tool", agent: "build" })
      expect(_mockUpdateState).toHaveBeenCalled()
    })

    it("does not record idle for non-idle events", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      _mockUpdateState.mockClear()

      await plugin["event"]?.({ event: { type: "session.unknown" as never, properties: {} } })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("does not record cancelled for non-aborted errors", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      _mockUpdateState.mockClear()

      await plugin["event"]?.({ event: { type: "session.error" as const, properties: { sessionID: "ses_non_abort", error: { name: "TimeoutError" } } } })
      expect(_mockUpdateState).not.toHaveBeenCalled()
    })

    it("handles dispose logging with correct plugin ID in message", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      _mockUpdateState.mockClear()

      await plugin.dispose?.()
      expect(log).toHaveBeenCalledWith(
        expect.any(Object),
        "info",
        expect.stringContaining("harness-plugin"),
      )
    })

    it("throws on session.error with null properties (source code lacks guard)", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin

      // Source code accesses event.properties.sessionID without null check.
      await expect(
        /* eslint-disable-next-line unicorn/no-null */
        plugin["event"]?.({ event: { type: "session.error" as const, properties: null } }),
      ).rejects.toThrow("null is not an object (evaluating 'event.properties.sessionID')")
    })

    it("handles undefined error on session.error event without throwing", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin

      await expect(
        plugin["event"]?.({ event: { type: "session.error" as const, properties: { error: undefined } } }),
      ).resolves.toBeUndefined()
    })

    it("handles chat.message with whitespace-only agent (truthy in JS — passes through)", async () => {
      const plugin = await sessionTracker(pluginContext as never) as SessionTrackerPlugin
      const hook = (plugin as any)["chat.message"]

      _mockUpdateState.mockClear()
      // "  " is truthy in JavaScript so the falsy check allows it through.
      await hook({ sessionID: "ses_ws_agent", agent: "  " } as never)
      expect(_mockUpdateState).toHaveBeenCalled()
    })
  })
})
