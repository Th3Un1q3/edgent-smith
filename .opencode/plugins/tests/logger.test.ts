import type { OpencodeClient } from "@opencode-ai/sdk"

import { beforeEach, describe, expect, it, vi } from "vitest"

import { log } from "@plugins/helpers/logger"

// We verify logger behavior by checking the client.app.log call output directly.
// The log() function is simple enough that we test its real behavior against a mock client.

function makeMockClient() {
  return {
    app: { log: vi.fn().mockResolvedValue(undefined) },
  } as unknown as OpencodeClient & { app: { log: ReturnType<typeof vi.fn> } }
}

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("log function", () => {
    it.each(["debug", "info", "warn", "error"])("logs with level '%s' when explicitly provided", async (level) => {
      const client = makeMockClient()

      await log(client, level as never, `test ${level} message`)

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level, message: `[harness-plugin] test ${level} message` },
      })
    })

    // ── Default parameter branch (the uncovered guard) ────────
    it("uses 'info' as the default level when no level argument is given", async () => {
      const client = makeMockClient()

      // Call with only two arguments — level uses its default of "info"
      await log(client, undefined as never, "default level test")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] default level test" },
      })
    })

    it("calls client.app.log with the correct service name", async () => {
      const client = makeMockClient()

      await log(client, "info", "service check")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] service check" },
      })
    })

    it("prefixes the message with the plugin ID in brackets", async () => {
      const client = makeMockClient()

      await log(client, "info", "some message")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] some message" },
      })
    })

    it("returns undefined (void) on success", async () => {
      const client = makeMockClient()
      const result = await log(client, "info", "return value test")
      expect(result).toBeUndefined()
    })

    it("handles empty string message correctly", async () => {
      const client = makeMockClient()

      await log(client, "info", "")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] " },
      })
    })
  })
})
