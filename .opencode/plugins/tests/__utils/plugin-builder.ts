import { vi } from 'vitest'
import { defaultCreateClient } from '@tests/helpers/mock-utilities'

export type PluginEnvironmentBuilderParameters = {
  clientFactory?: (options?: string | { agent?: string, data?: Record<string, unknown> }, agentOverride?: string) => ReturnType<typeof defaultCreateClient>
  projectFactory?: () => { id: string, worktree: string, time: { created: number, initialized?: number } }
  directory?: string
  worktree?: string
}

export type PluginContextBuilderReturn = {
  client: ReturnType<NonNullable<PluginEnvironmentBuilderParameters['clientFactory']>>
  project: ReturnType<typeof vi.fn> | { id: string, worktree: string, time: { created: number, initialized?: number } }
  directory: string
  worktree: string
  experimental_workspace: { register: ReturnType<typeof vi.fn> }
  serverUrl: URL
  $: ReturnType<typeof vi.fn>
}

const pluginContextBuilder = (parameters?: PluginEnvironmentBuilderParameters): PluginContextBuilderReturn => {
  const {
    clientFactory = defaultCreateClient,
    projectFactory = ((): ReturnType<typeof vi.fn> => vi.fn() as ReturnType<typeof vi.fn>) as unknown as NonNullable<PluginEnvironmentBuilderParameters['projectFactory']>,
    directory = '/workspace',
    worktree = '/workspace/.git',
  }: PluginEnvironmentBuilderParameters = parameters ?? {}

  return {
    client: clientFactory() as never,
    project: (projectFactory as unknown as () => ReturnType<typeof vi.fn>)() as ReturnType<typeof vi.fn>,
    directory,
    worktree,
    experimental_workspace: { register: vi.fn() as ReturnType<typeof vi.fn> },
    serverUrl: new URL('http://localhost'),
    $: vi.fn() as ReturnType<typeof vi.fn>,
  }
}

export { pluginContextBuilder }
