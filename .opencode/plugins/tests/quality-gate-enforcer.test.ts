import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
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
const mockReadState = _kvInstance.readState
const mockUpdateState = _kvInstance.updateState

import type { QualityGatesConfig } from "@plugins/types/quality-gate"
import type { CommandResult } from "@plugins/helpers/gate-runner"

// ── Fixtures ──────────────────────────────────────────────────────────────

const fixtureConfig: QualityGatesConfig = {
  gates: [
    { name: "lint", patterns: ["**/*.ts"], commands: ["just lint"] },
    { name: "test", patterns: ["**/*.test.ts"], commands: ["just test"] },
  ],
  debounceMs: 100,
}

const successResult: CommandResult = { exitCode: 0, stdout: "ok", stderr: "" }
const failureResult: CommandResult = {
  exitCode: 1,
  stdout: "error line 1",
  stderr: "error line 2",
}

const ADVANCE_TIMER_MS = (fixtureConfig.debounceMs ?? 100) + 50 // 150ms — kept for legacy non-timer-dependent assertions
const KNOWN_GATE_FLUSH_MS = 10_200 // maxQuietMs (10_000) + buffer for known-gate adaptive timer

// ── Tests ─────────────────────────────────────────────────────────────────

describe("qualityGateEnforcer", () => {
  let mockClient: ReturnType<typeof opencodeClientFactory>
  let mockContext: Record<string, unknown>
  let plugin: Record<string, unknown>

  beforeEach(async () => {
    vi.useFakeTimers()

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

    SessionStorage.reset() // re-apply mock implementations after vitest's mockReset
    vi.mocked(loadQualityGates).mockResolvedValue(fixtureConfig)
    vi.mocked(sendMessage).mockResolvedValue(undefined)

    // Call the plugin function — stub returns {} (empty hooks)
    plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── Plugin structure ───────────────────────────────────────────────────

  describe("plugin structure", () => {
    it("exports qualityGateEnforcer with setup, tool.execute.after, and dispose", () => {
      expect(typeof plugin.setup).toBe("function")
      expect(typeof plugin["tool.execute.after"]).toBe("function")
      expect(typeof plugin.dispose).toBe("function")
    })

    it("does not return early empty object", () => {
      expect(plugin).not.toEqual({})
    })
  })

  // ── Tool filtering ─────────────────────────────────────────────────────

  describe("tool filtering", () => {
    it("ignores non-edit/write tools", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)({ tool: "read", sessionID: "ses_1" }, {})
      expect(runGate).not.toHaveBeenCalled()
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

  // ── Dirty marking ──────────────────────────────────────────────────────

  describe("dirty marking", () => {
    it("marks matched gates dirty in KV on edit", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_mark", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      // Should have marked 'lint' dirty in KV
      expect(mockUpdateState).toHaveBeenCalled()
    })

    it("does not mark non-matching paths", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_nomatch", args: { filePath: "/workspace/README.md" } },
        { title: "", output: "", metadata: {} },
      )
      expect(mockUpdateState).not.toHaveBeenCalled()
    })

    it("evaluates unknown-status gates immediately without waiting for timer", async () => {
      // No prior state — gate is unknown
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_imm1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      // Drain microtasks from flush() → onBatch → evaluateDirtyGates → sendTransitionMessage
      await vi.advanceTimersByTimeAsync(0)

      // Should have flushed immediately — runGate and sendMessage called without timer advancement
      expect(runGate).toHaveBeenCalled()
      expect(sendMessage).toHaveBeenCalled()
    })
  })

  // ── Batch execution ────────────────────────────────────────────────────

  describe("batch execution", () => {
    it("runs all dirty gates after quiet period", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_batch1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Advance past debounceMs (100) to trigger batcher
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // lint should have been run
      expect(runGate).toHaveBeenCalled()
      // One consolidated message
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it("only runs dirty gates, not all configured gates", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_batch2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      // Only 'lint' should be dirty (main.ts matches **/*.ts but not **/*.test.ts)

      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // runGate should be called exactly once (for lint only), not for test
      expect(runGate).toHaveBeenCalledTimes(1)
    })

    it("sends exactly one consolidated message after quiet", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_batch3", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      expect(sendMessage).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.any(String) as string,
          sessionId: "ses_batch3",
          noReply: true,
        }),
      )
    })

    it("runs multiple gates matched by one file", async () => {
      // A .test.ts file matches both **/*.ts AND **/*.test.ts
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "write", sessionID: "ses_batch4", args: { filePath: "/workspace/src/util.test.ts" } },
        { title: "", output: "", metadata: {} },
      )

      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // Both gates should have been run
      expect(runGate).toHaveBeenCalledTimes(2)
      // Single consolidated message
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ── KV state transitions ──────────────────────────────────────────────

  describe("KV state transitions", () => {
    it("updates KV to pass on exit 0 after quiet", async () => {
      // mock runGate to return success BEFORE edit triggers immediate flush
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_kv1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // updateState should have been called with status 'pass'
      expect(mockUpdateState).toHaveBeenCalled()
      // calls[0] is the dirty-marking update; calls[1] is the batch-handler's result update
      const updaterFunction = mockUpdateState.mock.calls[1][1] as (state: Record<string, unknown>) => Record<string, unknown>
      const result = updaterFunction({})
      expect(result).toEqual({
        qualityGateStatuses: {
          lint: { dirty: false, status: "pass" },
        },
      })
    })

    it("updates KV to fail on non-zero exit", async () => {
      vi.mocked(runGate).mockResolvedValue(failureResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_kv2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      expect(mockUpdateState).toHaveBeenCalled()
      // calls[0] is the dirty-marking update; calls[1] is the batch-handler's result update
      const updaterFunction = mockUpdateState.mock.calls[1][1] as (state: Record<string, unknown>) => Record<string, unknown>
      const result = updaterFunction({})
      expect(result).toEqual({
        qualityGateStatuses: {
          lint: { dirty: false, status: "fail" },
        },
      })
    })

    it("resets dirty flag on new edit after terminal state", async () => {
      // First edit → gates pass → KV status becomes 'pass', dirty=false
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_kv3", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // Mock readState to return fail status (simulating stored KV state)
      mockReadState.mockReturnValue({
        qualityGateStatuses: {
          lint: { dirty: false, status: "fail" },
        },
      })

      // Second edit on same file → should reset dirty to true for re-check
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_kv3", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Should have called updateState again to set dirty=true
      expect(mockUpdateState).toHaveBeenCalled()
    })
  })

  // ── Diagnostic logging ─────────────────────────────────────────────────

  describe("diagnostic logging", () => {
    it("logs 'Sending transition message' before sendMessage in sendTransitionMessage", async () => {
      mockReadState.mockReturnValue(undefined) // unknown status
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_diag1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // Verify log was called with "Sending transition message" before sendMessage
      // Find the call to app.log that contains the expected message
      const logCalls = (mockClient.app.log as ReturnType<typeof vi.fn>).mock.calls as Array<[unknown]>
      const sendingCall = logCalls.find((call) => {
        const body = (call[0] as { body?: { message?: string } })?.body
        return typeof body?.message === "string" &&
          body.message.includes("Sending transition message for 1 gate(s) to session ses_diag1")
      })
      expect(sendingCall).toBeDefined()
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it("logs 'Transition message sent' after successful sendMessage", async () => {
      mockReadState.mockReturnValue(undefined) // unknown status
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_diag2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      const logCalls = (mockClient.app.log as ReturnType<typeof vi.fn>).mock.calls as Array<[unknown]>
      const sentCall = logCalls.find((call) => {
        const body = (call[0] as { body?: { message?: string } })?.body
        return typeof body?.message === "string" &&
          body.message.includes("Transition message sent to session ses_diag2")
      })
      expect(sentCall).toBeDefined()
    })

    it("logs 'onBatch fired' when batch callback triggers", async () => {
      mockReadState.mockReturnValue(undefined) // unknown status
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_diag3", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      const logCalls = (mockClient.app.log as ReturnType<typeof vi.fn>).mock.calls as Array<[unknown]>
      const onBatchCall = logCalls.find((call) => {
        const body = (call[0] as { body?: { message?: string } })?.body
        return typeof body?.message === "string" &&
          body.message.includes("onBatch fired with 1 dirty gate(s): lint")
      })
      expect(onBatchCall).toBeDefined()
    })
  })

  // ── Status transition messages ─────────────────────────────────────────

  describe("status transition messages", () => {
    it("sends message on status change (unknown→pass)", async () => {
      mockReadState.mockReturnValue(undefined) // unknown status
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_msg1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // Transition unknown→pass should send a message
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

    it("does NOT send message when status unchanged (pass→pass)", async () => {
      // First run: unknown→pass (sends message)
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_msg2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      // Clear calls so far
      vi.clearAllMocks()

      // Re-set mocks after clearAllMocks (mockReset: true reset implementations)
      vi.mocked(runGate).mockResolvedValue(successResult)

      // Mock readState to return pass (already passed)
      mockReadState.mockReturnValue({
        qualityGateStatuses: {
          lint: { dirty: false, status: "pass" },
        },
      })

      // Second run: pass→pass — uses adaptive timer for known gates
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_msg2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(KNOWN_GATE_FLUSH_MS)

      expect(sendMessage).not.toHaveBeenCalled()
    })

    it("sends message again on new transition (pass→fail)", async () => {
      // First run: unknown→pass
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_msg3", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      vi.clearAllMocks()

      // Re-set runGate mock after clearAllMocks (mockReset: true reset implementations)
      vi.mocked(runGate).mockResolvedValue(failureResult)

      // Mock readState to return pass
      mockReadState.mockReturnValue({
        qualityGateStatuses: {
          lint: { dirty: false, status: "pass" },
        },
      })

      // Second run: pass→fail (transition, should send message)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_msg3", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      await vi.advanceTimersByTimeAsync(KNOWN_GATE_FLUSH_MS)

      // Message should be sent for this new transition
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })
  })

  // ── Missing session ────────────────────────────────────────────────────

  describe("missing session", () => {
    it("falls back to client.app.log when no sessionID", async () => {
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: undefined, args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Should have logged via client.app.log instead of sendMessage
      expect(mockClient.app.log).toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  // ── Lifecycle ─────────────────────────────────────────────────────────

  describe("lifecycle", () => {
    it("dispose cancels pending timer for known-status gate", async () => {
      // Seed the in-memory state so updateState sees lint as "pass" (known gate).
      // mockReadState does NOT control classification — updateState reads from its
      // own globalInMemoryState, so we must seed via SessionStorage.reset().
      SessionStorage.reset({
        ses_life: { qualityGateStatuses: { lint: { dirty: false, status: "pass" } } },
      })

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_life", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Dispose should cancel the pending batcher timer
      expect(typeof plugin.dispose).toBe("function")
      await (plugin.dispose as (...arguments_: unknown[]) => unknown)()

      // Advance time — nothing should fire because timer was cancelled
      await vi.advanceTimersByTimeAsync(KNOWN_GATE_FLUSH_MS)

      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty gates config does nothing", async () => {
      // Re-mock loadQualityGates to return empty config
      vi.mocked(loadQualityGates).mockResolvedValue({
        gates: [],
        debounceMs: 100,
      })

      // Re-create plugin with empty config
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_empty", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      await vi.advanceTimersByTimeAsync(ADVANCE_TIMER_MS)

      expect(runGate).not.toHaveBeenCalled()
      expect(sendMessage).not.toHaveBeenCalled()
    })

    it("normalizes absolute paths to workspace-relative for glob matching", async () => {
      // Override config with a relative pattern that only matches AFTER normalization.
      // ".opencode/plugins/**/*.ts" won't match absolute "/workspace/.opencode/plugins/foo.ts"
      // but WILL match the normalized ".opencode/plugins/foo.ts".
      vi.mocked(loadQualityGates).mockResolvedValue({
        gates: [{ name: "opencode-typecheck", patterns: [".opencode/plugins/**/*.ts"], commands: ["just typecheck"] }],
        debounceMs: 100,
      })
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_norm1", args: { filePath: "/workspace/.opencode/plugins/foo.ts" } },
        { title: "", output: "", metadata: {} },
      )
      // After normalization, ".opencode/plugins/foo.ts" should match ".opencode/plugins/**/*.ts"
      expect(runGate).toHaveBeenCalled()
    })

    it("does not match absolute paths when pattern is relative (before normalization would fail)", async () => {
      // This verifies the root cause: with the relative pattern alone, the absolute
      // path "/workspace/src/main.ts" would NOT match the relative pattern "src/**/*.ts".
      // After normalization "src/main.ts" DOES match.
      vi.mocked(loadQualityGates).mockResolvedValue({
        gates: [{ name: "typecheck", patterns: ["src/**/*.ts"], commands: ["just typecheck"] }],
        debounceMs: 100,
      })
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_norm2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      // After normalization: "src/main.ts" matches "src/**/*.ts"
      expect(runGate).toHaveBeenCalled()
    })
  })
})
