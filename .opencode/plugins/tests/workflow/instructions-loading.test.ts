import { beforeEach, describe, expect, it } from 'vitest'

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

import { tmpdir } from 'node:os'

import path from 'node:path'

import { workflowConfig } from '@tests/workflow/plugin-state'

import { makeHarness, register, resetWorkflowMocks } from '@tests/workflow/harness'

import { REPO_ROOT } from '@tests/helpers/repo-root'

import { loadWorkflowInstructions } from '@plugins/workflow'

beforeEach(resetWorkflowMocks)

describe('workflow instructions registration log', () => {
  it('logs the loaded instruction source and content size once at registration', async () => {
    const h = makeHarness()

    await register(h)

    const loaded = h.logs.filter(entry => entry[0] === 'workflow.instructions.loaded')

    expect(loaded).toHaveLength(1)

    const details = loaded[0][1] as { path: string, resolvedPath: string, contentBytes: number, agents: string[] }

    expect(details.resolvedPath).toBe(path.resolve(REPO_ROOT, details.path))
    expect(details.contentBytes).toBe(Buffer.byteLength(readFileSync(details.resolvedPath, 'utf8'), 'utf8'))
    expect(details.agents).toEqual(['rug', 'rug-swe'])
  })
})

describe('workflow instruction config validation', () => {
  beforeEach(() => {
    workflowConfig.reset()
  })

  it('treats a path reading "Stryker was here!" as an ordinary path', () => {
    workflowConfig.set({ instructions: 'Stryker was here!' })

    expect(() => loadWorkflowInstructions(REPO_ROOT)).toThrow(/cannot read/)
  })

  it('rejects a non-string project directory', () => {
    expect(() => loadWorkflowInstructions(42 as unknown as string)).toThrow(/project directory is missing/)
  })

  it('rejects an instructions file that is only whitespace', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'workflow-instructions-'))
    const file = path.join(directory, 'empty.md')

    writeFileSync(file, '  \n')
    workflowConfig.set({ instructions: file })

    try {
      expect(() => loadWorkflowInstructions(REPO_ROOT)).toThrow(/file is empty or whitespace/)
    }
    finally {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  it('names the configured path and directory when the directory is unusable', () => {
    workflowConfig.set({ instructions: 'custom/instructions.md' })

    expect(() => loadWorkflowInstructions(7 as unknown as string)).toThrow(
      'cannot resolve custom/instructions.md against 7: project directory is missing',
    )
  })

  it('converts a non-Error configuration failure into an Error at registration', async () => {
    Object.defineProperty(workflowConfig.config.plugins, 'workflow', {
      configurable: true,
      get() {
        const failure: unknown = 'config exploded'
        throw failure as Error
      },
    })

    try {
      let failure: unknown
      try {
        await register(makeHarness())
      }
      catch (error) {
        failure = error
      }

      expect(failure).toBeInstanceOf(Error)
      expect((failure as Error).message).toBe('config exploded')
    }
    finally {
      delete (workflowConfig.config.plugins as { workflow?: unknown }).workflow
      workflowConfig.reset()
    }
  })

  it('fails registration when the instructions file cannot be read', async () => {
    workflowConfig.set({ instructions: '/nonexistent/workflow-instructions.md' })

    await expect(register(makeHarness())).rejects.toThrow(/cannot read/)
  })
})
