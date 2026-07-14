import { vi } from "vitest"
import { defaultCreateClient } from "../helpers/mock-utils"

export type PluginEnvironmentBuilderParameters = {
    clientFactory?: (opts?: string | { agent?: string; data?: Record<string, unknown> }, agentOverride?: string) => ReturnType<typeof defaultCreateClient>
    projectFactory?: () => { id: string; worktree: string; time: { created: number; initialized?: number }; }
    directory?: string
    worktree?: string
}

const pluginContextBuilder = (params?: PluginEnvironmentBuilderParameters) => {
    const {
        clientFactory = defaultCreateClient,
        projectFactory = () => vi.fn(),
        directory = "/workspace",
        worktree = "/workspace/.git",
    } = params || {}

    return {
        client: clientFactory() as never,
        project: projectFactory(),
        directory,
        worktree,
        experimental_workspace: { register: vi.fn() },
        serverUrl: new URL("http://localhost"),
        "$": vi.fn(),
    }
}

export { pluginContextBuilder }