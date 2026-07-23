import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"
import { opencodeClientFactory } from "@tests/__utils/factories/client-factory"

import { qualityGateEnforcer } from "@plugins/quality-gate-enforcer"

// ── Module mocks ──────────────────────────────────────────────────────────

vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())
vi.mock("@plugins/helpers/session-helpers", () => ({ sendMessage: vi.fn() }))
vi.mock("@plugins/helpers/gate-config", () => ({ loadQualityGates: vi.fn() }))
vi.mock("@plugins/helpers/gate-runner", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, runGate: vi.fn() }
})

// ── Mock reference imports ────────────────────────────────────────────────

import { SessionStorage } from "@plugins/helpers/kv-store"
import { sendMessage } from "@plugins/helpers/session-helpers"
import { loadQualityGates } from "@plugins/helpers/gate-config"
import { runGate } from "@plugins/helpers/gate-runner"

// Capture mock function references from SessionStorage (shared across instances)
const _kvInstance = new (SessionStorage as unknown as new () => {
  readState: ReturnType<typeof vi.fn>
  updateState: ReturnType<typeof vi.fn>
})()
const mockUpdateState = _kvInstance.updateState

import type { QualityGatesConfig } from "@plugins/types/quality-gate"
import type { CommandResult } from "@plugins/helpers/gate-runner"

// ── Fixtures ──────────────────────────────────────────────────────────────

const fixtureConfig: QualityGatesConfig = {
  gates: [
    { name: "lint", patterns: ["**/*.ts"], commands: ["just lint"] },
    { name: "test", patterns: ["**/*.test.ts"], commands: ["just test"] },
  ],
}

const successResult: CommandResult = { exitCode: 0, stdout: "ok", stderr: "" }
const failureResult: CommandResult = {
  exitCode: 1,
  stdout: "error line 1",
  stderr: "error line 2",
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("qualityGateEnforcer", () => {
  let mockClient: ReturnType<typeof opencodeClientFactory>
  let mockContext: Record<string, unknown>
  let plugin: Record<string, unknown>

  beforeEach(async () => {
    mockClient = opencodeClientFactory() as ReturnType<typeof opencodeClientFactory>
    mockContext = {
      client: mockClient,
      project: {},
      directory: "/workspace",
      worktree: "/workspace/.git",
      experimental_workspace: { register: vi.fn() },
      serverUrl: new URL("http://localhost"),
      $: vi.fn(),
    }

    SessionStorage.reset() // re-apply mock implementations
    vi.mocked(loadQualityGates).mockResolvedValue(fixtureConfig)
    vi.mocked(sendMessage).mockResolvedValue(undefined)

    plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)
  })

  // ── Plugin structure ───────────────────────────────────────────────────

  describe("plugin structure", () => {
    it("exports qualityGateEnforcer with tool.execute.after hook only", () => {
      expect(typeof plugin["tool.execute.after"]).toBe("function")
      expect(plugin.setup).toBeUndefined()
      expect(plugin.dispose).toBeUndefined()
    })

    it("does not return early empty object", () => {
      expect(plugin).not.toEqual({})
    })
  })

  // ── Tool filtering ─────────────────────────────────────────────────────

  describe("tool filtering", () => {
    it("ignores non-edit/write tools", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "read", sessionID: "ses_1" },
        {},
      )
      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })

    it("ignores missing filePath", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_2", args: {} },
        { title: "", output: "", metadata: {} },
      )
      expect(runGate).not.toHaveBeenCalled()
    })

    it("ignores empty filePath", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "write", sessionID: "ses_3", args: { filePath: "" } },
        { title: "", output: "", metadata: {} },
      )
      expect(runGate).not.toHaveBeenCalled()
    })
  })

  // ── Gate execution ────────────────────────────────────────────────────

  describe("gate execution", () => {
    it("runs matching gate immediately after edit", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_exec", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      expect(runGate).toHaveBeenCalled()
      expect(sendMessage).toHaveBeenCalled()
    })

    it("does not run gates for files matching no patterns", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_nomatch", args: { filePath: "/workspace/README.md" } },
        { title: "", output: "", metadata: {} },
      )

      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })

    it("only runs gates whose patterns match the file", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_selective", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Only lint matches (main.ts matches **/*.ts but not **/*.test.ts)
      expect(runGate).toHaveBeenCalledTimes(1)
    })

    it("runs all gates for a file matching multiple patterns", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "write", sessionID: "ses_multi", args: { filePath: "/workspace/src/util.test.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // .test.ts matches both **/*.ts and **/*.test.ts
      expect(runGate).toHaveBeenCalledTimes(2)
      // Single consolidated message for all transitions
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ── Status transitions ────────────────────────────────────────────────

  describe("status transitions", () => {
    it("sends message on status change from unknown to pass", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_trans1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // unknown → pass should trigger a message
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it("does not send message when status is unchanged (pass→pass)", async () => {
      // First edit: unknown → pass (sends message)
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_unchanged", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Second edit: gate still passes → status unchanged → no message
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_unchanged", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // runGate called both times
      expect(runGate).toHaveBeenCalledTimes(2)
      // sendMessage only called for the first transition
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it("sends message again on new transition from pass to fail", async () => {
      // First edit: unknown → pass (sends message)
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_trans2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Second edit: now gate fails → pass → fail (sends new message)
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_trans2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // One message per transition (two total)
      expect(sendMessage).toHaveBeenCalledTimes(2)
    })
  })

  // ── KV state updates ──────────────────────────────────────────────────

  describe("KV state updates", () => {
    it("stores pass status on exit 0", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_kv1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      expect(mockUpdateState).toHaveBeenCalled()
      // Two calls: first marks dirty=true, last writes final status with dirty=false
      const lastCall = mockUpdateState.mock.calls.at(-1)
      if (!lastCall) throw new Error("Expected at least one mockUpdateState call")
      const lastUpdater = lastCall[1] as (state: Record<string, unknown>) => Record<string, unknown>
      const result = lastUpdater({})
      expect(result).toEqual({
        qualityGateStatuses: {
          lint: { dirty: false, status: "pass" },
        },
      })
    })

    it("stores fail status on non-zero exit", async () => {
      vi.mocked(runGate).mockResolvedValue(failureResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_kv2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      expect(mockUpdateState).toHaveBeenCalled()
      const lastCall = mockUpdateState.mock.calls.at(-1)
      if (!lastCall) throw new Error("Expected at least one mockUpdateState call")
      const lastUpdater = lastCall[1] as (state: Record<string, unknown>) => Record<string, unknown>
      const result = lastUpdater({})
      expect(result).toEqual({
        qualityGateStatuses: {
          lint: { dirty: false, status: "fail" },
        },
      })
    })

    const input = {
      tool: "edit",
      sessionID: "ses_dirty",
      args: { filePath: "/workspace/src/main.ts" },
    }

    it("marks gates dirty before running, clears after completion", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        input,
        { title: "", output: "", metadata: {} },
      )

      // Get all update calls for this session
      const calls = (mockUpdateState as ReturnType<typeof vi.fn>).mock.calls.filter(
        (call: unknown[]) => call[0] === input.sessionID,
      )
      expect(calls.length).toBeGreaterThanOrEqual(2)

      // First call should set dirty: true
      const first = calls[0]
      if (!first) throw new Error("Expected first mockUpdateState call for session")
      const firstUpdater = first[1] as (state: Record<string, unknown>) => Record<string, unknown>
      const firstState = firstUpdater({}) as { qualityGateStatuses: Record<string, { dirty: boolean; status: string }> }
      expect(firstState.qualityGateStatuses.lint).toEqual({ dirty: true, status: "unknown" })

      // Last call should set dirty: false with new status
      const last = calls.at(-1)
      if (!last) throw new Error("Expected last mockUpdateState call for session")
      const lastUpdater = last[1] as (state: Record<string, unknown>) => Record<string, unknown>
      const lastState = lastUpdater({}) as { qualityGateStatuses: Record<string, { dirty: boolean; status: string }> }
      expect(lastState.qualityGateStatuses.lint).toEqual({ dirty: false, status: "pass" })
    })
  })

  // ── Session handling ─────────────────────────────────────────────────

  describe("session handling", () => {
    it("falls back to client.app.log when no sessionID", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: undefined, args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Should have logged via client.app.log
      expect(mockClient.app.log).toHaveBeenCalled()
      // Should not have called sendMessage since there's no session
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  // ── Diagnostic logging ────────────────────────────────────────────────

  describe("diagnostic logging", () => {
    it("logs transition message before sending", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_diag", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      const logCalls = (mockClient.app.log as ReturnType<typeof vi.fn>).mock.calls as Array<[unknown]>
      const sendingCall = logCalls.find((call) => {
        const body = (call[0] as { body?: { message?: string } })?.body
        return typeof body?.message === "string" &&
          body.message.includes("Sending transition message for 1 gate(s)")
      })
      expect(sendingCall).toBeDefined()
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty gates config does nothing", async () => {
      vi.mocked(loadQualityGates).mockResolvedValue({ gates: [] })

      // Re-create plugin with empty config
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_empty", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })

    it("normalizes absolute paths to workspace-relative for glob matching", async () => {
      vi.mocked(loadQualityGates).mockResolvedValue({
        gates: [{ name: "opencode-typecheck", patterns: [".opencode/plugins/**/*.ts"], commands: ["just typecheck"] }],
      })
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_norm1", args: { filePath: "/workspace/.opencode/plugins/foo.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // After normalization: ".opencode/plugins/foo.ts" matches ".opencode/plugins/**/*.ts"
      expect(runGate).toHaveBeenCalled()
    })

    it("treats gate command errors as failures", async () => {
      vi.mocked(runGate).mockRejectedValue(new Error("command not found"))

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_err", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Should be treated as a failure, triggering a status transition message
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })
  })
})
