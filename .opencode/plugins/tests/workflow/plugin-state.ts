import { vi } from 'vitest'

// Hoisted state the workflow mocks read. vitest runs a `vi.mock` factory ahead of
// the imports that trigger it, so every value a factory closes over lives here.

const workflowConfigState = vi.hoisted(() => {
  const defaults = {
    instructions: '.agents/skills/task-delegation/SKILL.md',
    agents: ['rug', 'rug-swe'],
  }
  const config: { plugins: { workflow?: { instructions?: unknown, agents?: unknown } } } = {
    plugins: { workflow: { ...defaults } },
  }
  return {
    config,
    set: (overrides: { instructions?: unknown, agents?: unknown }) => {
      config.plugins.workflow = { ...defaults, ...overrides }
    },
    reset: () => {
      config.plugins.workflow = { ...defaults }
    },
  }
})

// Re-exported through a plain binding: vitest refuses an `export` on a
// `vi.hoisted` declarator because export initialisation order is not hoisted.
export const workflowConfig = workflowConfigState

const entryClientState = vi.hoisted(() => ({
  writeEntry: vi.fn(),
  removeEntry: vi.fn(),
  findEntry: vi.fn(),
}))

export const entryClient = entryClientState

const subtaskFactoryState = vi.hoisted(() => ({ createSubtask: vi.fn() }))

export const subtaskFactory = subtaskFactoryState
