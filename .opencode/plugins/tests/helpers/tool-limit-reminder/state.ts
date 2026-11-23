import { vi } from 'vitest'

// Config is read at plugin-registration time; mutate this hoisted object before
// `register()` to steer the gate per scenario. The getter keeps the
// "missing section" fallback case reachable from a mocked module.
const tlrConfigState = vi.hoisted(() => ({
  present: true,
  factor: 0.8,
  padding: 2,
  limits: {} as Record<string, number>,
  ignoreTools: ['signal_send'],
  review: { export: true, command: 'just agent_utils/export-opencode-session', writeMarkdown: true },
}))

// Re-exported through a plain binding: vitest refuses an `export` on a
// `vi.hoisted` declarator because export initialisation order is not hoisted.
export const tlrConfig = tlrConfigState

// The export shell. `$` is a plain function (not a `vi.fn`) so `mockReset`
// cannot strip its implementation; calls are recorded in hoisted state.
const shellState = vi.hoisted(() => ({ exitCode: 0, commands: [] as string[] }))

export const shell = shellState
