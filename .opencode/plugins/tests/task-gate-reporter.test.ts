import { describe, it, expect, vi, beforeEach } from "vitest"
import { makeKvStoreMockFactory } from "@tests/__utils/kv-store.mock"

// ── Module mocks (hoisted by vitest) ─────────────────────────────────────

vi.mock("@plugins/helpers/kv-store", () => makeKvStoreMockFactory())
vi.mock("@plugins/helpers/logger", () => ({ log: vi.fn() }))

// ── Mock reference imports ───────────────────────────────────────────────

import { SessionStorage } from "@plugins/helpers/kv-store"

import { taskGateReporter } from "@plugins/task-gate-reporter"

// Capture mock function references from SessionStorage (shared across instances)
const _kvInstance = new (SessionStorage as unknown as new () => {
    readState: ReturnType<typeof vi.fn>
})()
const mockReadState = _kvInstance.readState

// ── Helpers ──────────────────────────────────────────────────────────────

function makeOutput(overrides?: Partial<{ output: string; metadata: Record<string, unknown> | undefined }>) {
    return { output: "Task completed successfully.", title: "", metadata: { sessionId: "ses_child_1" }, ...overrides }
}

function makeInput(overrides?: Partial<Record<string, unknown>>) {
    return { tool: "task", sessionID: "ses_parent", callID: "call_1", args: {}, ...overrides }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("task-gate-reporter", () => {
    let plugin: Record<string, unknown>
    let hook: (input: Record<string, unknown>, output: Record<string, unknown>) => Promise<void>

    beforeEach(async () => {
        // Re-apply mock implementations after vitest's mockReset
        SessionStorage.reset()

        const mockContext = {
            client: {} as unknown,
            directory: "/workspace",
        }

        plugin = await (taskGateReporter as unknown as (
            context: unknown,
        ) => Promise<Record<string, unknown>>)(mockContext)

        hook = plugin["tool.execute.after"] as (
            input: Record<string, unknown>,
            output: Record<string, unknown>,
        ) => Promise<void>
    })

    // ── Test 1: Appends failing gates when child session has failing gates

    it("appends failing gates when child session has failing gates", async () => {
        SessionStorage.reset({
            ses_child_1: {
                qualityGateStatuses: {
                    lint: { dirty: false, status: "fail" },
                    typecheck: { dirty: false, status: "pass" },
                },
            },
        })

        const output = makeOutput()

        await hook(makeInput(), output)

        expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
        expect(output.output).toMatch(/^Task completed successfully\./)
        expect(output.output).toContain("FAILING QUALITY GATES: lint")
        expect(output.output).not.toContain("typecheck")
    })

    // ── Test 2: Does NOT append when all gates pass in child session

    it("does NOT append when all gates pass in child session", async () => {
        SessionStorage.reset({
            ses_child_1: {
                qualityGateStatuses: {
                    lint: { dirty: false, status: "pass" },
                },
            },
        })

        const output = makeOutput()

        await hook(makeInput({ callID: "call_2" }), output)

        expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
        expect(output.output).not.toContain("FAILING QUALITY GATES")
    })

    // ── Test 3: Does NOT append when no quality gates in child session state

    it("does NOT append when no quality gates in child session state", async () => {
        SessionStorage.reset({
            ses_child_1: {},
        })

        const output = makeOutput()

        await hook(makeInput({ callID: "call_3" }), output)

        expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
        expect(output.output).not.toContain("FAILING QUALITY GATES")
    })

    // ── Test 4: Does NOT append when child session has no state

    it("does NOT append when child session has no state", async () => {
        // SessionStorage.reset() with no matching key → readState returns undefined
        SessionStorage.reset({})

        const output = makeOutput()

        await expect(
            hook(makeInput({ callID: "call_4" }), output),
        ).resolves.toBeUndefined()

        expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
        expect(output.output).toBe("Task completed successfully.")
    })

    // ── Test 5: Does NOT intercept non-task tools

    it("does NOT intercept non-task tools", async () => {
        const output = makeOutput()

        await hook(makeInput({ tool: "edit", sessionID: "ses_parent", callID: "call_5" }), output)

        expect(mockReadState).not.toHaveBeenCalled()
        expect(output.output).not.toContain("FAILING QUALITY GATES")
    })

    // ── Test 6: Does NOT append when metadata has no sessionId

    it("does NOT append when metadata has no sessionId", async () => {
        const output = makeOutput({ metadata: {} })

        await hook(makeInput({ callID: "call_6" }), output)

        expect(mockReadState).not.toHaveBeenCalled()
        expect(output.output).not.toContain("FAILING QUALITY GATES")
    })

    // ── Test 7: Does NOT append when metadata is undefined

    it("does NOT append when metadata is undefined", async () => {
        const output = makeOutput({ metadata: undefined })

        await hook(makeInput({ callID: "call_7" }), output)

        expect(mockReadState).not.toHaveBeenCalled()
        expect(output.output).not.toContain("FAILING QUALITY GATES")
    })

    // ── Test 8: Returns early when readState results in undefined

    it("returns early when readState results in undefined", async () => {
        mockReadState.mockReturnValue(undefined)

        const output = makeOutput()

        await hook(makeInput({ callID: "call_8" }), output)

        expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
        expect(output.output).toBe("Task completed successfully.")
    })

    // ── Test 9: Appends failing gates message to empty output

    it("appends failing gates message to empty output", async () => {
        SessionStorage.reset({
            ses_child_1: {
                qualityGateStatuses: {
                    lint: { dirty: false, status: "fail" },
                },
            },
        })

        const output = makeOutput({ output: "" })

        await hook(makeInput({ callID: "call_9" }), output)

        expect(mockReadState).toHaveBeenCalledWith("ses_child_1", expect.any(Function))
        expect(output.output).toBe("\n\n⚠️ FAILING QUALITY GATES: lint")
    })

    // ── Test 10: Appends multiple failing gates with comma separator

    it("appends multiple failing gates with comma separator", async () => {
        SessionStorage.reset({
            ses_child_1: {
                qualityGateStatuses: {
                    lint: { dirty: false, status: "fail" },
                    typecheck: { dirty: false, status: "fail" },
                    format: { dirty: false, status: "pass" },
                },
            },
        })

        const output = makeOutput()

        await hook(makeInput({ callID: "call_10" }), output)

        expect(output.output).toMatch(/^Task completed successfully\./)
        expect(output.output).toContain("FAILING QUALITY GATES: lint, typecheck")
        expect(output.output).not.toContain("format")
    })
})
