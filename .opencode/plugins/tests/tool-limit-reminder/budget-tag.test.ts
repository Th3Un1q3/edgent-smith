import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  idle,
  makeHarness,
  register,
  resetScenario,
  stopPluginFibers,
} from '@tests/helpers/tool-limit-reminder/harness'

beforeEach(resetScenario)
afterEach(stopPluginFibers)

describe('tool-limit-reminder budget tag', () => {
  it('prepends the resolved budget tag to the first prompt only', async () => {
    const h = makeHarness()

    await register(h)

    const first = { sessionID: 'ses_1', prompt: { text: 'hello' } }

    await h.prompt(first)

    expect(first.prompt.text).toBe('<task-budget tool-calls="4" />\nhello')

    const second = { sessionID: 'ses_1', prompt: { text: 'again' } }

    await h.prompt(second)

    expect(second.prompt.text).toBe('again')
  })

  it('skips the tag when the session has no agent', async () => {
    const h = makeHarness()

    h.sessions.set('ses_1', { metadata: {} })
    await register(h)

    const prompt = { sessionID: 'ses_1', prompt: { text: 'hello' } }

    await h.prompt(prompt)

    expect(prompt.prompt.text).toBe('hello')
  })

  it('re-injects the tag after an idle reset', async () => {
    const h = makeHarness()

    await register(h)

    const first = { sessionID: 'ses_1', prompt: { text: 'hello' } }

    await h.prompt(first)
    await h.emit(idle('ses_1'))

    const second = { sessionID: 'ses_1', prompt: { text: 'again' } }

    await h.prompt(second)

    expect(second.prompt.text).toBe('<task-budget tool-calls="4" />\nagain')
  })
})
