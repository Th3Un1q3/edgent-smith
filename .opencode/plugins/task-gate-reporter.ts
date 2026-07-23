import { Plugin } from "@opencode-ai/plugin"
import { SessionStorage } from "./helpers/kv-store"

export const taskGateReporter: Plugin = async () => {
    const sessionStorage = new SessionStorage()

    return {
        "tool.execute.after": async (input, output) => {
            // Only run on "task" tool
            if (input.tool !== "task") return

            // Extract child session ID from task output metadata.
            // The task tool spawns a subagent in a child session; quality gates
            // are tracked in that child session's state, not the parent's.
            const childSessionID = (output.metadata as Record<string, unknown> | undefined)?.sessionId as string | undefined
            if (!childSessionID) return

            // Read quality gate statuses from the CHILD session's state
            const state = sessionStorage.readState(childSessionID, (s) => s as Record<string, unknown>)
            if (!state) return

            const gateStatuses = state.qualityGateStatuses as
                Record<string, { dirty: boolean; status: string }> | undefined
            if (!gateStatuses) return

            // Find failing gates
            const failingGates = Object.entries(gateStatuses)
                .filter(([_, info]) => info.status === "fail")
                .map(([name]) => name)

            if (failingGates.length === 0) return

            // Append warning to output
            const failMessage = `\n\n⚠️ FAILING QUALITY GATES: ${failingGates.join(", ")}`
            output.output = (output.output || "") + failMessage
        },
    }
}
