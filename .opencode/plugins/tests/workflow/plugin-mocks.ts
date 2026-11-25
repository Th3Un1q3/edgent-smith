import { vi } from 'vitest'

import { entryClient, subtaskFactory, workflowConfig } from '@tests/workflow/plugin-state'

// This module exists only for its registrations and therefore exports nothing;
// a side-effect module is the shape the exported-module purity rule expects.
vi.mock('@plugins/config/harness', () => ({ harnessConfig: workflowConfig.config }))

vi.mock('@plugins/helpers/instructions/entry-client', () => ({
  writeEntry: entryClient.writeEntry,
  removeEntry: entryClient.removeEntry,
  findEntry: entryClient.findEntry,
}))

vi.mock('@plugins/workflow/subtask', () => ({ createSubtask: subtaskFactory.createSubtask }))

vi.mock('@plugins/workflow/subtask-ls', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@plugins/workflow/subtask-ls')>()

  return { ...actual, listSubtasksFromSessions: vi.fn(actual.listSubtasksFromSessions) }
})
