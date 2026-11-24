import { describe, expect, it } from 'vitest'

import { Effect, Exit } from 'effect'

import { makeHarness, register } from '@tests/workflow/harness'

import plugin from '@plugins/workflow'

describe('workflow (v2)', () => {
  it('registers the standalone tools with JSON-Schema inputs (workflow retired)', async () => {
    const h = makeHarness()

    await register(h)
    expect(h.tools).toHaveLength(3)
    expect(h.tools[0].name).toBe('subtask_ls')
    expect(h.tools[1].name).toBe('subtask_run')
    expect(h.tools[2].name).toBe('subtask_outputs')
    expect(typeof h.tools[1].execute).toBe('function')

    const names = h.tools.map(tool => tool.name)

    expect(names).not.toContain('workflow')
  })

  it('accepts only task_id and count on subtask_outputs', async () => {
    const h = makeHarness()

    await register(h)

    const input = h.tools[2].input as { properties: Record<string, unknown>, additionalProperties: boolean }

    expect(Object.keys(input.properties)).toEqual(['task_id', 'count'])
    expect(input.additionalProperties).toBe(false)
  })

  it('offers only ok and error as subtask_ls status filters', async () => {
    const h = makeHarness()

    await register(h)

    const input = h.tools[0].input as { properties: { status: { enum: string[] } } }

    expect(input.properties.status.enum).toEqual(['ok', 'error'])
  })

  it('propagates a throwing registration instead of swallowing it', async () => {
    const h = makeHarness()
    const tool = h.context.tool as unknown as {
      transform: (callback: (editor: unknown) => void) => Effect.Effect<unknown>
    }

    tool.transform = (callback) => {
      callback({
        add: () => {
          throw new Error('add exploded')
        },
      })
      return Effect.succeed({ dispose: Effect.void })
    }

    const exit = await Effect.runPromiseExit(Effect.scoped(plugin.effect(h.context)))

    expect(Exit.isFailure(exit)).toBe(true)
    expect(h.tools).toHaveLength(0)
  })
})
