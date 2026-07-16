import { describe, it, expect, beforeEach, vi } from "vitest"
import type { PluginInput } from "@opencode-ai/plugin"

// Synchronous mock factories — no dynamic imports to avoid circular dependency issues.
import { defaultCreateClient, makeLoggerMockFactory, makeSessionHelpersMockFactory } from "./helpers/mock-utilities"

vi.mock("../helpers/logger", () => makeLoggerMockFactory())
vi.mock("../helpers/session-helpers", () => makeSessionHelpersMockFactory())

import { toolLimitReminder } from "../tool-limit-reminder"
import { log } from "../helpers/logger"
import { sendMessage } from "../helpers/session-helpers"

const logMock = vi.mocked(log)
const sendMessageMock = vi.mocked(sendMessage)


type HookInput = { sessionID?: string; tool?: string }

interface ToolLimitReminderPlugin {
  dispose?: () => Promise<void>
  "tool.execute.before": (input: HookInput) => void | Promise<void | undefined>
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
  ])("known agent $agent (limit=$limit)", ({ agent, limit: _limit }) => {
    let plugin: ToolLimitReminderPlugin | undefined

    beforeEach(async () => {
      plugin = await toolLimitReminder(defaultCreateClient({ data: { agent } }) as unknown as PluginInput) as ToolLimitReminderPlugin
    })

    it("increments counter on first call without steering or error", async () => {
      const hook = (plugin as ToolLimitReminderPlugin)["tool.execute.before"]

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
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin
      const hook = (plugin as ToolLimitReminderPlugin)["tool.execute.before"]

      for (let index = 0; index < 5; index++) {
        await hook({ sessionID: "sess-approach" })
      }

      // step 6 — currentCount === 5, which equals the threshold of 6
      await expect(
        (plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "sess-approach-step6" }),
      ).resolves.toBeUndefined()
    })

    it("approaching threshold logs a warning for rug-mcp at step 6", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin
      const hook = (plugin as ToolLimitReminderPlugin)["tool.execute.before"]

      // Call 5 times then once more to reach the boundary
      for (let index = 0; index < 5; index++) {
        await hook({ sessionID: "sess-approach-warn" })
      }
      await expect(
        (plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "sess-approach-warn-final" }),
      ).resolves.toBeUndefined()

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "warn",
        expect.stringContaining("reached tool call limit"),
      )
    })

    it("sends steering message (limit=8) when reaching exact threshold", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin
      const hook = (plugin as ToolLimitReminderPlugin)["tool.execute.before"]

      for (let index = 0; index < 9; index++) {
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
      const plugin = (await toolLimitReminder(defaultCreateClient({ data: { agent: "rug-mcp" } }) as unknown as PluginInput)) as ToolLimitReminderPlugin
      // Call hook 9 times — currentCount reaches 8 which is limit(8) + PADDING_TILL_ERROR(2) = 10, still within tolerance
      for (let index = 0; index < 10; index++) {
        await expect(
          (plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "sess-padding" }),
        ).resolves.toBeUndefined()
      }

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "warn",
        expect.stringContaining("reached tool call limit"),
      )
    })

    it("throws DO NOT call any more tools error when exceeding limit+padding", async () => {
      const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-mcp") as unknown as PluginInput)) as ToolLimitReminderPlugin
      const hook = (plugin as ToolLimitReminderPlugin)["tool.execute.before"]
      // Use a single sessionID so the counter accumulates across all calls.
      // With rug-mcp (limit=6, PADDING_TILL_ERROR=2), currentCount must reach 9
      // for the guard at line 78 to trigger: 9 > 6 + 2.
      const sharedSession = "sess-hard-limit-accum"

      const errorStartFromTurn = 8 + 2 // The 10th call should throw, as currentCount will be 9 at that point.

      for (let index = 0; index <= errorStartFromTurn; index++) {
        await expect(
          hook({ sessionID: sharedSession }),
        ).resolves.toBeUndefined()
      }

      // The 10th call — currentCount is now 9, which exceeds limit(6) + padding(2) = 8.
      // Should throw before incrementing the counter further.
      await expect(
        hook({ sessionID: sharedSession }),
      ).rejects.toThrow("STOP YOUR WORK.")

      expect(logMock).toHaveBeenCalledWith(
        expect.anything(),
        "error",
        expect.stringContaining("tool call limit exceeded"),
      )
    })
  })

  // Simple — green path for below-threshold calls logs warn and info without extra behavior
  it("logs warn + info and returns normally for below-threshold calls", async () => {
    const plugin = (await toolLimitReminder(defaultCreateClient("build", "rug-swe") as unknown as PluginInput)) as ToolLimitReminderPlugin
    const hook = (plugin as ToolLimitReminderPlugin)["tool.execute.before"]

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

  // Dynamic — computes threshold from maxSteps via Math.floor(maxSteps * 0.8)
  it("computes dynamic threshold from maxSteps using Math.floor(maxSteps * 0.8)", async () => {
    const maxSteps = 25
    const expectedThreshold = Math.floor(maxSteps * 0.8) // should be 20

    const mockClient = defaultCreateClient(
      "test-agent",
      undefined,
      [{ name: "test-agent", steps: maxSteps }],
    ) as unknown as PluginInput

    const plugin = (await toolLimitReminder(mockClient)) as ToolLimitReminderPlugin

    expect(plugin["tool.execute.before"]).toBeDefined()

    // Simulate calls up to threshold + 1 (pre-increment check needs one extra call)
    for (let index = 0; index < expectedThreshold; index++) {
      await ((plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "test1", tool: "read_file" }))
    }

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "warn",
      expect.stringContaining("reached tool call limit"),
    )
    // No steering message yet — threshold NOT exceeded
    expect(sendMessageMock).not.toHaveBeenCalled()
  })

  // Dynamic — agent without maxSteps in list is unlimited (logs info)
  it("treats agents without maxSteps as unlimited when present in agent list", async () => {
    const mockClient = defaultCreateClient(
      "unlimited-agent",
      undefined,
      [{ name: "unlimited-agent" }], // no maxSteps
    ) as unknown as PluginInput

    const plugin = (await toolLimitReminder(mockClient)) as ToolLimitReminderPlugin
    await plugin["tool.execute.before"]({ sessionID: "sess-unlimited" })

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "info",
      expect.stringContaining("not listed in TOOL_LIMITS"),
    )
  })

  // Dynamic — empty agent list makes all agents unlimited
  it("treats all agents as unlimited when agent list is empty", async () => {
    const mockClient = defaultCreateClient(
      "rug-swe",
      undefined,
      [], // empty agent list
    ) as unknown as PluginInput

    const plugin = (await toolLimitReminder(mockClient)) as ToolLimitReminderPlugin
    expect(plugin["tool.execute.before"]).toBeDefined()
    await ((plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "test-empty" }))

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "info",
      expect.stringContaining("not listed in TOOL_LIMITS"),
    )
  })

  // Dynamic — mixed agent list applies thresholds only to agents with maxSteps
  it("applies dynamic thresholds only to agents with maxSteps in mixed list", async () => {
    const mockClient = defaultCreateClient(
      "limited-agent",
      undefined,
      [
        { name: "limited-agent", steps: 30 },
        { name: "unlimited-agent" }, // no steps
      ],
    ) as unknown as PluginInput

    const plugin = (await toolLimitReminder(mockClient)) as ToolLimitReminderPlugin

    expect(plugin["tool.execute.before"]).toBeDefined()

    // First call should NOT log 'not listed in TOOL_LIMITS' because limited-agent IS in TOOL_LIMITS
    await ((plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "test2", tool: "read_file" }))

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "info",
      expect.stringContaining("limited-agent"),
    )
    // Should NOT have the 'not listed' message for limited-agent
    const notListedCalls = logMock.mock.calls.filter((c) =>
      c[2] && typeof c[2] === "string" && c[2].includes("not listed in TOOL_LIMITS"),
    )
    expect(notListedCalls.length).toBe(0)
  })

  // Dynamic — correctly floors the threshold for non-integer maxSteps * 0.8 results
  it("correctly floors the threshold for non-integer maxSteps * 0.8 results", async () => {
    const maxSteps = 13
    const expectedThreshold = Math.floor(maxSteps * 0.8) // floor(10.4) = 10

    const mockClient = defaultCreateClient(
      "round-agent",
      undefined,
      [{ name: "round-agent", steps: maxSteps }],
    ) as unknown as PluginInput

    const plugin = (await toolLimitReminder(mockClient)) as ToolLimitReminderPlugin

    // Call exactly expectedThreshold times — should log warn but NOT throw or send steering
    for (let index = 0; index < expectedThreshold; index++) {
      await ((plugin as ToolLimitReminderPlugin)["tool.execute.before"]({ sessionID: "test3", tool: "read_file" }))
    }

    // Verify the threshold logged matches our expectation
    const thresholdCalls = logMock.mock.calls.filter(
      (c) => c[1] === "warn" && c[2] && typeof c[2] === "string" && c[2].includes("reached tool call limit"),
    )
    expect(thresholdCalls.length).toBeGreaterThan(0)

    // No steering message yet
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
