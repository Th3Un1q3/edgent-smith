import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_OUTPUTS_COUNT,
  MAX_OUTPUTS_COUNT,
  readSubtaskOutputs,
  subtaskOutputsTool,
} from '@plugins/workflow/subtask-outputs'

const { listMessages } = vi.hoisted(() => ({ listMessages: vi.fn() }))

vi.mock('@plugins/helpers/runtime/service-client', () => ({
  getClient: async () => ({ message: { list: listMessages } }),
}))

const message = (text: string, created: number, extra: Record<string, unknown> = {}) => ({
  id: `msg_${created}`,
  type: 'assistant',
  time: { created },
  content: [{ type: 'text', text }],
  ...extra,
})

const page = (...messages: Array<Record<string, unknown>>) => ({ data: messages })

const listerOf = (...messages: Array<Record<string, unknown>>) => ({ list: () => page(...messages) })

describe('readSubtaskOutputs', () => {
  it('returns entries oldest first', async () => {
    const lister = listerOf(message('second', 2000), message('first', 1000))

    const result = await readSubtaskOutputs(lister, 'ses_sub_1')

    expect(result.entries.map(entry => entry.outputText)).toEqual(['first', 'second'])
    expect(result.entries[0]).toEqual({
      task_id: 'ses_sub_1',
      outputText: 'first',
      sent_at: '1970-01-01T00:00:01.000Z',
      status: 'ok',
    })
    expect(result.total_messages).toBe(2)
  })

  it('joins assistant text parts with a newline and drops empty texts', async () => {
    const lister = listerOf({
      id: 'msg_join',
      type: 'assistant',
      time: { created: 1000 },
      content: [
        { type: 'text', text: 'alpha' },
        { type: 'tool', tool: 'read' },
        { type: 'text', text: '' },
        { type: 'text', text: 'beta' },
      ],
    })

    const result = await readSubtaskOutputs(lister, 'ses_sub_join')

    expect(result.entries[0].outputText).toBe('alpha\nbeta')
    expect(result.entries[0].sent_at).toBe('1970-01-01T00:00:01.000Z')
  })

  it('defaults to 3 rows and caps at 5', async () => {
    const messages = Array.from({ length: 6 }, (_, index) => message(`out ${index}`, 1000 + index))
    const lister = listerOf(...messages)

    const defaults = await readSubtaskOutputs(lister, 'ses_sub_cap')

    expect(defaults.entries).toHaveLength(DEFAULT_OUTPUTS_COUNT)
    expect(defaults.entries.map(entry => entry.outputText)).toEqual(['out 3', 'out 4', 'out 5'])
    expect(defaults.total_messages).toBe(6)

    const capped = await readSubtaskOutputs(lister, 'ses_sub_cap', { count: 500 })

    expect(capped.entries).toHaveLength(MAX_OUTPUTS_COUNT)
    expect(capped.entries.map(entry => entry.outputText)).toEqual(['out 1', 'out 2', 'out 3', 'out 4', 'out 5'])
  })

  it('reports error for a carried error and finish=content-filter', async () => {
    const lister = listerOf(
      message('plain', 1000),
      message('failed', 2000, { error: { message: 'boom' } }),
      message('filtered', 3000, { finish: 'content-filter' }),
    )

    const result = await readSubtaskOutputs(lister, 'ses_sub_status')

    expect(result.entries.map(entry => entry.status)).toEqual(['ok', 'error', 'error'])
  })

  it('returns [] for an empty id and when the lister throws', async () => {
    const list = vi.fn(() => page())

    expect(await readSubtaskOutputs({ list }, '')).toEqual({ entries: [], total_messages: 0 })
    expect(await readSubtaskOutputs({ list }, undefined)).toEqual({ entries: [], total_messages: 0 })
    expect(list).not.toHaveBeenCalled()

    const throwing = {
      list: () => {
        throw new Error('offline')
      },
    }

    expect(await readSubtaskOutputs(throwing, 'ses_sub_missing')).toEqual({ entries: [], total_messages: 0 })
  })
})

describe('subtaskOutputsTool', () => {
  it('exposes the subtask_outputs tool contract', async () => {
    listMessages.mockReturnValue(page(message('tool output', 1000)))

    const tool = subtaskOutputsTool('/workspace')

    expect(tool.name).toBe('subtask_outputs')
    expect(tool.input.properties).toMatchObject({
      task_id: { type: 'string', minLength: 1 },
      count: { type: 'integer', minimum: 1, maximum: 5, default: 3 },
    })

    const result = await Effect.runPromise(tool.execute({ task_id: 'ses_sub_tool' }))

    expect(JSON.parse(result.content)).toEqual([
      {
        task_id: 'ses_sub_tool',
        outputText: 'tool output',
        sent_at: '1970-01-01T00:00:01.000Z',
        status: 'ok',
      },
    ])
    expect(result.metadata.title).toBe('subtask_outputs: 1 output(s)')
    expect(result.metadata.total_messages).toBe(1)
    expect(listMessages).toHaveBeenCalledWith({
      sessionID: 'ses_sub_tool',
      type: 'assistant',
      order: 'desc',
      limit: MAX_OUTPUTS_COUNT,
    })
  })
})
