import { describe, it, expect, beforeEach, vi } from "vitest"
import type { Mock } from "vitest"

vi.mock("../helpers/logger", () => ({ log: vi.fn() }))
vi.mock("../helpers/session-helpers", () => ({ sendMessage: vi.fn() }))

import { toolLimitReminder } from "../tool-limit-reminder"
import { log } from "../helpers/logger"
import { sendMessage } from "../helpers/session-helpers"

const logMock = vi.mocked(log) as Mock<typeof log>
const sendMessageMock = vi.mocked(sendMessage) as Mock<typeof sendMessage>

function createClient(agentName: string, defaultAgent?: string) {
  return {
    client: {
      session: {
        get: vi.fn().mockResolvedValue({ data: { agent: defaultAgent ?? agentName } }),
      },
    },
    project: vi.fn(),
    directory: "/workspace",
    worktree: "/workspace/.git",
    experimental_workspace: { register: vi.fn() },
    serverUrl: new URL("http://localhost"),
    $: vi.fn(),
  } as never
}

interface ToolLimitReminderPlugin {
  dispose?: () => Promise<void>
  "tool.execute.before": (input: { sessionID?: string }) => Promise<void | undefined>
}

// Zero — missing sessionID logs warn and returns without any other side effects
describe("missing sessionID", () => {
  it("logs warning when sessionID is absent in input", async () => {
    const plugin = (await toolLimitReminder(createClient("rug-swe"))) as ToolLimitReminderPlugin
    const hook = plugin["tool.execute.before"]

    await hook({})

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "warn",
      expect.stringContaining("missing sessionID"),
    )
  })
})

// One — unlisted agent skips limit check entirely (logs info, no counter increment)
describe("unlisted agent", () => {
  it("skips limit check for unlisted agents and logs info", async () => {
    const plugin = (await toolLimitReminder(createClient("build"))) as ToolLimitReminderPlugin
    const hook = plugin["tool.execute.before"]

    await hook({ sessionID: "sess-1" })

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "info",
      expect.stringContaining("not listed in TOOL_LIMITS"),
    )
  })
})

// Many — known agents increment counter on first call without steering or error (green path)
describe.each([
  { agent: "rug-swe", limit: 20 },
  { agent: "rug-mcp", limit: 6 },
  { agent: "rug-expert", limit: 15 },
])("known agent $agent (limit=$limit)", ({ agent }) => {
  let plugin: ToolLimitReminderPlugin | undefined

  beforeEach(async () => {
    plugin = await toolLimitReminder(createClient("build", agent)) as ToolLimitReminderPlugin
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

// Boundary — approaching threshold (one below limit): warn logged, no error or steering
describe("approaching threshold for rug-mcp", () => {
  let plugin: ToolLimitReminderPlugin | undefined

  beforeEach(async () => {
    plugin = await toolLimitReminder(createClient("build", "rug-mcp")) as ToolLimitReminderPlugin
  })

  it("step 6 does not throw", async () => {
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
})

// Interface — reaching exact threshold sends steering message with expected content
describe("reaching exact threshold for rug-mcp", () => {
  let plugin: ToolLimitReminderPlugin | undefined

  beforeEach(async () => {
    plugin = await toolLimitReminder(createClient("build", "rug-mcp")) as ToolLimitReminderPlugin
  })

  it("sends steering message (limit=6)", async () => {
    const hook = plugin!["tool.execute.before"]

    // Call the hook 7 times to reach threshold on rug-mcp (limit=6)
    for (let i = 0; i < 7; i++) {
      await expect(
        plugin!["tool.execute.before"]({ sessionID: "sess-threshold" }),
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
})

// padding calls for rug-mcp return without error
describe("padding calls for rug-mcp", () => {
  let plugin: ToolLimitReminderPlugin | undefined

  beforeEach(async () => {
    plugin = await toolLimitReminder(createClient("build", "rug-mcp")) as ToolLimitReminderPlugin
  })

  it("return without error within padding tolerance (limit=6)", async () => {
    // Call hook 9 times — currentCount reaches 8 which is limit(6) + PADDING_TILL_ERROR(2) = 8, still within tolerance
    for (let i = 0; i < 9; i++) {
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
})

// hard-limit throws error message when exceeded
describe("hard-limit for rug-mcp", () => {
  let plugin: ToolLimitReminderPlugin | undefined

  beforeEach(async () => {
    plugin = await toolLimitReminder(createClient("build", "rug-mcp")) as ToolLimitReminderPlugin
  })

  it("throws DO NOT call any more tools error when exceeding limit+padding", async () => {
    const hook = plugin!["tool.execute.before"]
    // Use a single sessionID so the counter accumulates across all calls.
    // With rug-mcp (limit=6, PADDING_TILL_ERROR=2), currentCount must reach 9
    // for the guard at line 78 to trigger: 9 > 6 + 2.
    const sharedSession = "sess-hard-limit-accum"

    for (let i = 0; i < 9; i++) {
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
describe("below-threshold green path", () => {
  let plugin: ToolLimitReminderPlugin | undefined

  beforeEach(async () => {
    plugin = await toolLimitReminder(createClient("build", "rug-swe")) as ToolLimitReminderPlugin
  })

  it("logs warn + info and returns normally for below-threshold calls", async () => {
    const hook = plugin!["tool.execute.before"]

    expect(sendMessageMock).not.toHaveBeenCalled()

    await expect(
      plugin!["tool.execute.before"]({ sessionID: "sess-simple" }),
    ).resolves.toBeUndefined()

    expect(logMock).toHaveBeenCalledWith(
      expect.anything(),
      "warn",
      expect.stringContaining("reached tool call limit"),
    )
    expect(sendMessageMock).not.toHaveBeenCalled()
  })
})
