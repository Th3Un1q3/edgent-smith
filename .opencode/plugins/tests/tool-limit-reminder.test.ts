import { describe, it, expect, beforeEach, vi } from "vitest"
import type { PluginInput } from "@opencode-ai/plugin"

// Synchronous mock factories — no dynamic imports to avoid circular dependency issues.
import { defaultCreateClient, makeLoggerMockFactory, makeSessionHelpersMockFactory } from "./helpers/mock-utils"

vi.mock("../helpers/logger", () => makeLoggerMockFactory())
vi.mock("../helpers/session-helpers", () => makeSessionHelpersMockFactory())

import { toolLimitReminder } from "../tool-limit-reminder"
import { log } from "../helpers/logger"
import { sendMessage } from "../helpers/session-helpers"

const logMock = vi.mocked(log)
const sendMessageMock = vi.mocked(sendMessage)


interface ToolLimitReminderPlugin {
  dispose?: () => Promise<void>
  "tool.execute.before": (input: { sessionID?: string }) => Promise<void | undefined>
}

describe("toolLimitReminder plugin", () => {

  // Zero — missing sessionID logs warn and returns without any other side effects
  it("logs warning when sessionID is absent in input", async () => {
    const plugin = (await toolLimitReminder(defaultCreateClient("rug-swe") as unknown as PluginInput)) as ToolLimitReminderPlugin
    const hook = plugin["tool.execute.before"]

    await hook({})

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "warn",
      expect.stringContaining("missing sessionID"),
    )
  })

  // One — unlisted agent skips limit check entirely (logs info, no counter increment)
  it("skips limit check for unlisted agents and logs info", async () => {
    const plugin = (await toolLimitReminder(defaultCreateClient("build") as unknown as PluginInput)) as ToolLimitReminderPlugin
    const hook = plugin["tool.execute.before"]

    await hook({ sessionID: "sess-1" })

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "info",
      expect.stringContaining("not listed in TOOL_LIMITS"),
    )
  })

  // Many — known agents increment counter on first call without steering or error (green path)
  describe.each([
    { agent: "rug-swe", limit: 20 },
    { agent: "rug-mcp", limit: 8 },
    { agent: "rug-expert", limit: 15 },
  ])("known agent $agent (limit=$limit)", ({ agent, limit }) => {
    let plugin: ToolLimitReminderPlugin | undefined

    beforeEach(async () => {
      plugin = await toolLimitReminder(defaultCreateClient({ data: { agent } }) as unknown as PluginInput) as ToolLimitReminderPlugin
    })

    it("increments counter on first call without steering or error", async () => {
      const hook = plugin!["tool.execute.before"]

      expect(sendMessageMock).not.toHaveBeenCalled()
      await hook({ sessionID: "sess-many" })

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "warn",
        expect.stringContaining("reached tool call limit"),
      )
      expect(sendMessageMock).not.toHaveBeenCalled()
    })
  })

  // Boundary — threshold behavior for rug-mcp (limit=8)
  describe("threshold behavior for rug-mcp", () => {

    it("approaching threshold does not throw (step 6)", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin | undefined
      const hook = plugin!["tool.execute.before"]

      for (let i = 0; i < 5; i++) {
        await hook({ sessionID: "sess-approach" })
      }

      // step 6 — currentCount === 5, which equals the threshold of 6
      await expect(
        plugin!["tool.execute.before"]({ sessionID: "sess-approach-step6" }),
      ).resolves.toBeUndefined()
    })

    it("approaching threshold logs a warning for rug-mcp at step 6", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin | undefined
      const hook = plugin!["tool.execute.before"]

      // Call 5 times then once more to reach the boundary
      for (let i = 0; i < 5; i++) {
        await hook({ sessionID: "sess-approach-warn" })
      }
      await expect(
        plugin!["tool.execute.before"]({ sessionID: "sess-approach-warn-final" }),
      ).resolves.toBeUndefined()

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "warn",
        expect.stringContaining("reached tool call limit"),
      )
    })

    it("sends steering message (limit=8) when reaching exact threshold", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin | undefined
      const hook = plugin!["tool.execute.before"]

      for (let i = 0; i < 9; i++) {
        await expect(
          hook({ sessionID: "sess-threshold" }),
        ).resolves.toBeUndefined()
      }

      expect(sendMessageMock).toHaveBeenCalledTimes(1)
      expect(sendMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          noReply: true,
          message: expect.stringContaining("Scope Creep Detected"),
        }),
      )
      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "warn",
        expect.stringContaining("reached tool call limit"),
      )
    })

    it("returns without error within padding tolerance (limit=8)", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient({ data: { agent: "rug-mcp" } }) as unknown as PluginInput)) as ToolLimitReminderPlugin | undefined
      // Call hook 9 times — currentCount reaches 8 which is limit(8) + PADDING_TILL_ERROR(2) = 10, still within tolerance
      for (let i = 0; i < 10; i++) {
        await expect(
          plugin!["tool.execute.before"]({ sessionID: "sess-padding" }),
        ).resolves.toBeUndefined()
      }

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "warn",
        expect.stringContaining("reached tool call limit"),
      )
    })

    it("throws DO NOT call any more tools error when exceeding limit+padding", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin | undefined
      const hook = plugin!["tool.execute.before"]
      // Use a single sessionID so the counter accumulates across all calls.
      // With rug-mcp (limit=6, PADDING_TILL_ERROR=2), currentCount must reach 9
      // for the guard at line 78 to trigger: 9 > 6 + 2.
      const sharedSession = "sess-hard-limit-accum"

      const errorStartFromTurn = 8 + 2 // The 10th call should throw, as currentCount will be 9 at that point.

      for (let i = 0; i <= errorStartFromTurn; i++) {
        await expect(
          hook({ sessionID: sharedSession }),
        ).resolves.toBeUndefined()
      }

      // The 10th call — currentCount is now 9, which exceeds limit(6) + padding(2) = 8.
      // Should throw before incrementing the counter further.
      await expect(
        hook({ sessionID: sharedSession }),
      ).rejects.toThrow("DO NOT call any more tools")

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "error",
        expect.stringContaining("tool call limit exceeded"),
      )
    })
  })

  // Simple — green path for below-threshold calls logs warn and info without extra behavior
  it("logs warn + info and returns normally for below-threshold calls", async () => {
    const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-swe") as unknown as PluginInput)) as ToolLimitReminderPlugin | undefined
    const hook = plugin!["tool.execute.before"]

    expect(sendMessageMock).not.toHaveBeenCalled()

    await expect(
      hook({ sessionID: "sess-simple" }),
    ).resolves.toBeUndefined()

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "warn",
      expect.stringContaining("reached tool call limit"),
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
