import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeKvStoreMockFactory, resetMockState } from "@tests/__utils/kv-store.mock"
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

    resetMockState() // re-apply mock implementations
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

  // ── KV state updates have been removed ────────────────────────────────
  // updateGateStatus calls were removed from tool.execute.after, so
  // SessionStorage.updateState is no longer called during gate execution.
  // GatesState is tracked in-memory via the gatesState closure variable.

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

  // ── Error logging on updateState removed ──────────────────────────────
  // updateGateStatus error logging was removed along with the
  // updateGateStatus function itself.

  // ── gatesState tracking ───────────────────────────────────────────────

  describe("gatesState tracking", () => {
    it("tracks gate status across sessions preventing redundant messages", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      // First execution: unknown → pass, sends message
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gs1", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Second execution (different session, same gate via gatesState): pass → pass, no message
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gs2", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // Only 1 message for the first transition (unknown→pass)
      expect(sendMessage).toHaveBeenCalledTimes(1)
      expect(runGate).toHaveBeenCalledTimes(2)
    })

    it("clears affectedSessions when gate passes and detects new transitions", async () => {
      // Step 1: ses_A triggers gate → fails (unknown→fail, sends message)
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gcA", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      // Step 2: ses_B triggers gate → fails (fail→fail via gatesState, no transition, no message)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gcB", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      expect(sendMessage).toHaveBeenCalledTimes(1)

      // Step 3: ses_A triggers gate → passes (fail→pass, sends message, clears affectedSessions)
      vi.mocked(runGate).mockResolvedValue(successResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gcA", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      expect(sendMessage).toHaveBeenCalledTimes(2)

      // Step 4: ses_A triggers gate → fails again (pass→fail via gatesState from step 3, sends message)
      vi.mocked(runGate).mockResolvedValue(failureResult)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gcA", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )
      expect(sendMessage).toHaveBeenCalledTimes(3)
    })
  })

  // ── tool.execute.before ───────────────────────────────────────────────

  describe("tool.execute.before", () => {
    it("runs unknown-status gates before edit and reports baseline", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.before"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_before1" },
        { args: { filePath: "/workspace/src/main.ts" } },
      )

      // Only "lint" matches **/*.ts
      expect(runGate).toHaveBeenCalledTimes(1)
      expect(sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("<steering"),
        }),
      )
    })

    it("does not run gates that already have status in gatesState", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      // First, run tool.execute.after for main.ts (lint runs, status→"pass" in gatesState)
      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_gs_before", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // runGate called once by after handler
      expect(runGate).toHaveBeenCalledTimes(1)
      // sendMessage called once by after handler (unknown→pass)
      expect(sendMessage).toHaveBeenCalledTimes(1)

       // Then call tool.execute.before for the same file
       await (plugin["tool.execute.before"] as (...arguments_: unknown[]) => unknown)(
         { tool: "edit", sessionID: "ses_gs_before" },
         { args: { filePath: "/workspace/src/main.ts" } },
       )

      // runGate should NOT have been called again by the before handler
      expect(runGate).toHaveBeenCalledTimes(1)
      // sendMessage should NOT have been called again
      expect(sendMessage).toHaveBeenCalledTimes(1)
    })

     it("ignores non-edit/write tools", async () => {
       await (plugin["tool.execute.before"] as (...arguments_: unknown[]) => unknown)(
         { tool: "read", sessionID: "ses_before2" },
         { args: { filePath: "/workspace/src/main.ts" } },
       )

      expect(runGate).not.toHaveBeenCalled()
    })

    it("skips gates with unknown status if no matching patterns", async () => {
       await (plugin["tool.execute.before"] as (...arguments_: unknown[]) => unknown)(
         { tool: "edit", sessionID: "ses_before3" },
         { args: { filePath: "/workspace/README.md" } },
       )

      expect(runGate).not.toHaveBeenCalled()
    })

    it("sends only one message when before handler fires multiple times rapidly", async () => {
      // Use debounce so both handlers start within the same window and both see unknown status
      vi.useFakeTimers()
      vi.mocked(loadQualityGates).mockResolvedValue({
        gates: [{ name: "lint", patterns: ["**/*.ts"], commands: ["just lint"] }],
        debounceMs: 100,
      })
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)

      const input = {
        tool: "edit",
        sessionID: "ses_before_dedup",
      }
      const output = { args: { filePath: "/workspace/src/main.ts" } }

      // Fire two before calls within the debounce window — both see unknown
      const handler1 = (plugin["tool.execute.before"] as (...arguments_: unknown[]) => Promise<unknown>)(input, output)
      const handler2 = (plugin["tool.execute.before"] as (...arguments_: unknown[]) => Promise<unknown>)(input, output)

      // Advance past debounce — gate runs once, both handlers continue
      await vi.advanceTimersByTimeAsync(100)

      await handler1
      await handler2

      // runGate called once (debounce consolidated the two calls)
      expect(runGate).toHaveBeenCalledTimes(1)
      // Only one transition message — beforeTransitionSent suppresses duplicate
      expect(sendMessage).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
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

  // ── runGatePooled ───────────────────────────────────────────────────────

  describe("runGatePooled", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("consolidates same-gate runs under a single promise with debounce", async () => {
      vi.useFakeTimers()

      vi.mocked(loadQualityGates).mockResolvedValue({
        gates: fixtureConfig.gates,
        debounceMs: 100,
      })
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)

      const input = {
        tool: "edit",
        sessionID: "ses_pool_debounce",
        args: { filePath: "/workspace/src/main.ts" },
      }

      // Fire two consecutive calls (both match "lint")
      const handler1 = (plugin["tool.execute.after"] as (...arguments_: unknown[]) => Promise<unknown>)(input, {})
      const handler2 = (plugin["tool.execute.after"] as (...arguments_: unknown[]) => Promise<unknown>)(input, {})

      // Advance timers by debounceMs (100ms) — async to flush microtasks
      await vi.advanceTimersByTimeAsync(100)

      await handler1
      await handler2

      // runGate called only ONCE (consolidation + debounce works)
      expect(runGate).toHaveBeenCalledTimes(1)
    })

    it("executes immediately when debounceMs is 0", async () => {
      // Default config (no debounceMs)
      vi.mocked(loadQualityGates).mockResolvedValue(fixtureConfig)
      plugin = await (qualityGateEnforcer as unknown as (context: unknown) => Promise<Record<string, unknown>>)(mockContext)

      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => Promise<unknown>)(
        { tool: "edit", sessionID: "ses_immediate", args: { filePath: "/workspace/src/main.ts" } },
        { title: "", output: "", metadata: {} },
      )

      // runGate was called (no setTimeout delay)
      expect(runGate).toHaveBeenCalled()
    })

    it("caches the same gate promise while running without debounce", async () => {
      // Use a never-resolving promise so runGatePooled keeps the cached entry
      const neverResolving = new Promise<CommandResult>(() => { /* never resolves */ })
      vi.mocked(runGate).mockReturnValue(neverResolving)

      // Use sessionID: undefined to skip the await updateGateStatus before runGatePooled
      // (otherwise the handler suspends on the updateGateStatus microtask before reaching runGate)
      const input = {
        tool: "edit",
        sessionID: undefined,
        args: { filePath: "/workspace/src/main.ts" },
      }

      // Fire first call — runGate called synchronously inside execute(), promise stored in pendingRuns
       
      const _handler1 = (plugin["tool.execute.after"] as (...arguments_: unknown[]) => Promise<unknown>)(input, {})

      // Fire second call — should find existing promise, NOT call runGate again
       
      const _handler2 = (plugin["tool.execute.after"] as (...arguments_: unknown[]) => Promise<unknown>)(input, {})

      // runGate was called only once despite two handlers
      expect(runGate).toHaveBeenCalledTimes(1)
    })
  })

  // ── Task tool handling ──────────────────────────────────────────────────

  describe("task tool handling", () => {
    it("appends failing gates to task output when task tool completes", async () => {
      resetMockState({
        ses_child_1: {
          qualityGateStatuses: {
            lint: { dirty: false, status: "fail" },
          },
        },
      })

      const output = {
        output: "Task completed successfully.",
        title: "",
        metadata: { sessionId: "ses_child_1" },
      }

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "task", sessionID: "ses_parent", callID: "call_1", args: {} },
        output,
      )

      expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
      expect(output.output).toContain("Task completed successfully.")
      expect(output.output).toContain("FAILING QUALITY GATES: lint")
    })

    it("skips when all child gates pass", async () => {
      resetMockState({
        ses_child_1: {
          qualityGateStatuses: {
            lint: { dirty: false, status: "pass" },
          },
        },
      })

      const output = {
        output: "Task done.",
        title: "",
        metadata: { sessionId: "ses_child_1" },
      }

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "task", sessionID: "ses_parent", callID: "call_2", args: {} },
        output,
      )

      expect(output.output).toBe("Task done.")
      expect(output.output).not.toContain("FAILING QUALITY GATES")
    })

    it("skips when no child session ID in metadata", async () => {
      const output = {
        output: "Task done.",
        title: "",
        metadata: {},
      }

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "task", sessionID: "ses_parent", callID: "call_3", args: {} },
        output,
      )

      expect(output.output).toBe("Task done.")
      expect(mockReadState).not.toHaveBeenCalled()
    })

    it("skips non-task tools normally", async () => {
      vi.mocked(runGate).mockResolvedValue(successResult)

      await (plugin["tool.execute.after"] as (...arguments_: unknown[]) => unknown)(
        { tool: "edit", sessionID: "ses_edit", callID: "call_4", args: { filePath: "/workspace/src/main.ts" } },
        { output: "", title: "", metadata: {} },
      )

      expect(runGate).toHaveBeenCalled()
    })
  })
})
