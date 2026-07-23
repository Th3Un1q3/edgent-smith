import type { OpencodeClient } from "@opencode-ai/sdk"

import { beforeEach, describe, expect, it, vi } from "vitest"

function makeMockClient() {
  return {
    app: { log: vi.fn().mockResolvedValue(undefined) },
  } as unknown as OpencodeClient & { app: { log: ReturnType<typeof vi.fn> } }
}

describe("logger", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe("log function", () => {
    // ── Explicit log level tests ────────
    // Individual `it()` blocks instead of `it.each` so Stryker's perTest coverage
    // maps each test to the exact source line it exercises, killing all StringLiteral
    // mutants including the PLUGIN_ID constant and the type-annotation level strings.
    //
    // All tests use dynamic import() after vi.resetModules() to force Bun to re-read
    // the source file on every test. This ensures Stryker's mutated file is loaded
    // instead of a cached original, allowing the StringLiteral mutant on PLUGIN_ID
    // to be properly killed.

    it("logs with level 'debug' when explicitly provided", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      await log(client, "debug" as never, "test debug message")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "debug", message: "[harness-plugin] test debug message" },
      })
    })

    it("logs with level 'info' when explicitly provided", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      await log(client, "info" as never, "test info message")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] test info message" },
      })
    })

    it("logs with level 'warn' when explicitly provided", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      await log(client, "warn" as never, "test warn message")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "warn", message: "[harness-plugin] test warn message" },
      })
    })

    it("logs with level 'error' when explicitly provided", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      await log(client, "error" as never, "test error message")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "error", message: "[harness-plugin] test error message" },
      })
    })

    // ── Default parameter branch (the uncovered guard) ────────
    it("uses 'info' as the default level when no level argument is given", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()

      // Call with only two arguments — level uses its default of "info"
      await log(client, undefined as never, "default level test")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] default level test" },
      })
    })

    it("calls client.app.log with the correct service name", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()

      await log(client, "info", "service check")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] service check" },
      })
    })

    it("prefixes the message with the plugin ID in brackets", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()

      await log(client, "info", "some message")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] some message" },
      })
    })

    it("returns undefined (void) on success", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      const result = await log(client, "info", "return value test")
      expect(result).toBeUndefined()
    })

    it("handles empty string message correctly", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()

      await log(client, "info", "")

      expect(client.app.log).toHaveBeenCalledWith({
        body: { service: "harness-plugin", level: "info", message: "[harness-plugin] " },
      })
    })

    it("uses exact plugin ID 'harness-plugin' in service field", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      await log(client, "warn", "plugin id check")

      // Extract the first call argument and assert with toBe (not deep equality)
      // to ensure Stryker's sandbox properly detects the mutated PLUGIN_ID constant.
      const callArgument = client.app.log.mock.calls[0] as [{ body: { service: string } }]
      expect(callArgument[0].body.service).toBe("harness-plugin")
    })

    it("uses exact plugin ID 'harness-plugin' in message prefix", async () => {
      const { log } = await import("@plugins/helpers/logger")
      const client = makeMockClient()
      await log(client, "error", "prefix check")

      const callArgument = client.app.log.mock.calls[0] as [{ body: { message: string } }]
      expect(callArgument[0].body.message).toBe("[harness-plugin] prefix check")
    })

    it("PLUGIN_ID constant has the expected value 'harness-plugin'", async () => {
      // Dynamic import after vi.resetModules() ensures we read Stryker's mutated
      // file rather than a cached original. Direct verification of the exported
      // constant kills StringLiteral mutants that replace "harness-plugin" with "".
      const { PLUGIN_ID } = await import("@plugins/helpers/logger")
      expect(PLUGIN_ID).toBe("harness-plugin")
    })

    it("requires a valid client — throws when client is null or undefined", async () => {
      const { log } = await import("@plugins/helpers/logger")
      // When the client is not provided, the log function should not silently no-op.
      // Instead, it should throw because accessing .app.log on undefined would fail.
      await expect(
        log(undefined as unknown as OpencodeClient, "warn", "no client available"),
      ).rejects.toThrow()
    })
  })
})
